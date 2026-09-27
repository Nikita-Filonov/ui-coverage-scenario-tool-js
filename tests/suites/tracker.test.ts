import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, vi } from 'vitest';
import { makeResult, makePage, makeScenario, makeTransition, test } from '../fixtures';
import { UICoverageTracker, ActionType, SelectorType } from '../../src';
import { UICoverageTrackerStorage } from '../../src/tracker/storage';
import { CoverageElementResultList } from '../../src/tracker/models/elements';
import { CoveragePageResultList } from '../../src/tracker/models/pages';
import { CoverageScenarioResultList } from '../../src/tracker/models/scenarios';
import { CoverageTransitionResultList } from '../../src/tracker/models/transitions';
import {
  isElementResult,
  isPageResult,
  isScenarioResult,
  isTransitionResult
} from '../../src/tracker/models/validation';

describe('result lists', () => {
  test('counts repeated actions and separates selectors by type', () => {
    const list = new CoverageElementResultList({
      results: [
        makeResult(),
        makeResult(),
        makeResult({ actionType: ActionType.Fill }),
        makeResult({ selectorType: SelectorType.XPath })
      ]
    });
    expect(list.totalActions).toBe(4);
    expect(list.totalSelectors).toBe(2);
    expect(list.countAction(ActionType.Click)).toBe(3);
    expect(list.countAction(ActionType.Hover)).toBe(0);
    expect(list.groupedByAction.get(ActionType.Fill)?.totalActions).toBe(1);
    expect(list.groupedBySelector.get(`${encodeURIComponent('#login')}|CSS`)?.totalActions).toBe(3);
  });
  test('filters elements by app and scenario without mutating results', () => {
    const list = new CoverageElementResultList({
      results: [makeResult(), makeResult({ app: 'other' }), makeResult({ scenario: 'Other' })]
    });
    expect(list.filter({ app: 'SHOP', scenario: 'LOGIN' }).totalActions).toBe(1);
    expect(list.filter({ scenario: 'login' }).totalActions).toBe(2);
    expect(list.filter({ app: 'shop' }).totalActions).toBe(2);
    expect(list.filter({ app: 'unknown' }).totalActions).toBe(0);
    expect(list.filter({}).totalActions).toBe(3);
    expect(list.totalActions).toBe(3);
  });
  test('selector grouping accepts delimiters, Unicode and empty selectors', () => {
    const selectors = ['[title="Привет | 100%"]', '//div[@id="a|b"]', ''];
    const list = new CoverageElementResultList({
      results: selectors.flatMap((selector) => [
        makeResult({ selector }),
        makeResult({ selector, selectorType: SelectorType.XPath })
      ])
    });
    expect(list.totalSelectors).toBe(6);
  });
  test('filters pages, keeps the first metadata and deduplicates scenario names', () => {
    const list = new CoveragePageResultList({
      results: [
        makePage(),
        makePage({ priority: 2 }),
        makePage({ scenario: 'Other' }),
        makePage({ page: 'Home' }),
        makePage({ app: 'other' })
      ]
    });
    expect(list.filter({ app: 'SHOP' }).results).toHaveLength(4);
    expect(list.filter({}).results).toHaveLength(5);
    expect(list.unique().results).toHaveLength(2);
    expect(list.unique().results[0].priority).toBe(1);
    expect(list.findScenarios({ page: 'Login' })).toEqual(['Login', 'Other']);
    expect(list.findScenarios({ page: 'Missing' })).toEqual([]);
  });
  test('filters scenarios case insensitively', () => {
    const list = new CoverageScenarioResultList({ results: [makeScenario(), makeScenario({ app: 'other' })] });
    expect(list.filter({ app: 'SHOP' }).results).toEqual([makeScenario()]);
    expect(list.filter({ app: 'missing' }).results).toEqual([]);
    expect(list.filter({}).results).toHaveLength(2);
  });
  test('counts directional transitions and deduplicates scenario names', () => {
    const list = new CoverageTransitionResultList({
      results: [
        makeTransition(),
        makeTransition(),
        makeTransition({ scenario: 'Other' }),
        makeTransition({ fromPage: 'Home', toPage: 'Login' }),
        makeTransition({ app: 'other' })
      ]
    });
    expect(list.filter({ app: 'SHOP' }).results).toHaveLength(4);
    expect(list.filter({}).results).toHaveLength(5);
    expect(list.unique().results).toHaveLength(2);
    expect(list.countTransitions({ fromPage: 'Login', toPage: 'Home' })).toBe(4);
    expect(list.findScenarios({ fromPage: 'Login', toPage: 'Home' })).toEqual(['Login', 'Other']);
    expect(list.findScenarios({ fromPage: 'Home', toPage: 'Login' })).toEqual(['Login']);
    expect(list.countTransitions({ fromPage: 'Missing', toPage: 'Home' })).toBe(0);
  });
});

const contexts = [
  { name: 'element', result: makeResult(), valid: isElementResult },
  { name: 'page', result: makePage(), valid: isPageResult },
  { name: 'scenario', result: makeScenario(), valid: isScenarioResult },
  { name: 'transition', result: makeTransition(), valid: isTransitionResult }
] as const;

describe('result validation', () => {
  test.for(contexts)('validates $name fields and rejects malformed data', ({ result, valid }) => {
    expect(valid(result)).toBe(true);
    for (const value of [null, 1, 'text', [], {}, { apps: {} }]) expect(valid(value)).toBe(false);
    for (const key of Object.keys(result)) {
      const invalid = { ...result, [key]: key === 'url' ? 1 : null };
      expect(valid(invalid)).toBe(false);
    }
  });
  test.each([NaN, Infinity, -Infinity])('rejects non-finite timestamps and priorities: %s', (value) => {
    expect(isElementResult(makeResult({ timestamp: value }))).toBe(false);
    expect(isPageResult(makePage({ priority: value }))).toBe(false);
  });
  test('rejects unknown enums and accepts all supported actions and selector types', () => {
    expect(isElementResult({ ...makeResult(), actionType: 'UNKNOWN' })).toBe(false);
    expect(isElementResult({ ...makeResult(), selectorType: 'UNKNOWN' })).toBe(false);
    for (const actionType of Object.values(ActionType))
      for (const selectorType of Object.values(SelectorType))
        expect(isElementResult(makeResult({ actionType, selectorType }))).toBe(true);
    expect(isScenarioResult(makeScenario({ url: 'https://tms.example/1' }))).toBe(true);
  });
});

describe('tracker lifecycle and storage', () => {
  test('does not record interactions without an active scenario', async ({ settings }) => {
    const tracker = new UICoverageTracker({ app: 'shop', settings });
    await tracker.trackPage(makePage());
    await tracker.trackElement(makeResult());
    await tracker.trackTransition(makeTransition());
    await tracker.endScenario();
    expect(console.warn).toHaveBeenCalledTimes(3);
    expect(await fs.stat(settings.resultsDir).catch(() => null)).toBe(null);
  });
  test('writes all result types and clears active scenario after end', async ({ settings }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(5000));
    const tracker = new UICoverageTracker({ app: 'shop', settings });
    const storage = new UICoverageTrackerStorage({ settings });
    tracker.startScenario({ name: 'Login', url: 'https://tms.example/1' });
    await tracker.trackPage(makePage());
    await tracker.trackElement(makeResult());
    await tracker.trackCoverage(makeResult({ actionType: ActionType.Fill }));
    await tracker.trackTransition(makeTransition());
    await tracker.endScenario();
    await tracker.endScenario();
    await tracker.trackElement(makeResult());
    const files = await fs.readdir(settings.resultsDir);
    expect(files).toHaveLength(5);
    expect(files.every((file) => /^[\da-f-]{36}-(page|element|scenario|transition)\.json$/.test(file))).toBe(true);
    expect((await storage.loadPageResults()).results).toEqual([makePage()]);
    expect((await storage.loadScenarioResults()).results).toEqual([makeScenario({ url: 'https://tms.example/1' })]);
    expect((await storage.loadTransitionResults()).results).toEqual([makeTransition()]);
    const elements = await storage.loadElementResults();
    expect(elements.totalActions).toBe(2);
    expect(elements.countAction(ActionType.Fill)).toBe(1);
    expect(elements.results.every((r) => r.timestamp === 5000)).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('deprecated'));
  });
  test('supports consecutive scenarios without leaking metadata', async ({ settings }) => {
    const tracker = new UICoverageTracker({ app: 'shop', settings });
    tracker.startScenario({ name: 'Login', url: null });
    await tracker.trackElement(makeResult());
    await tracker.endScenario();
    tracker.startScenario({ name: 'Logout', url: 'https://tms.example/2' });
    await tracker.trackElement(makeResult());
    await tracker.endScenario();
    const results = await new UICoverageTrackerStorage({ settings }).loadElementResults();
    expect(results.filter({ scenario: 'Login' }).totalActions).toBe(1);
    expect(results.filter({ scenario: 'Logout' }).totalActions).toBe(1);
  });
  test('loads empty lists for a missing directory', async ({ settings }) => {
    const storage = new UICoverageTrackerStorage({ settings });
    expect((await storage.loadElementResults()).results).toEqual([]);
    expect((await storage.loadPageResults()).results).toEqual([]);
    expect((await storage.loadScenarioResults()).results).toEqual([]);
    expect((await storage.loadTransitionResults()).results).toEqual([]);
  });
  test.for(contexts)('ignores malformed JSON and data for $name', async ({ name, result }, { settings }) => {
    const storage = new UICoverageTrackerStorage({ settings });
    await storage.save({ context: name, result });
    for (const [i, value] of [null, 1, 'text', [], {}, { ...result, app: 1 }, { apps: {} }].entries())
      await fs.writeFile(path.join(settings.resultsDir, `${i}-${name}.json`), JSON.stringify(value));
    await fs.writeFile(path.join(settings.resultsDir, `bad-${name}.json`), '{');
    await fs.writeFile(path.join(settings.resultsDir, 'notes.txt'), '{}');
    await fs.mkdir(path.join(settings.resultsDir, `nested-${name}.json`));
    const load = {
      element: () => storage.loadElementResults(),
      page: () => storage.loadPageResults(),
      scenario: () => storage.loadScenarioResults(),
      transition: () => storage.loadTransitionResults()
    }[name];
    expect((await load()).results).toEqual([result]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to parse file'));
  });
  test('logs write failures', async ({ settings }) => {
    vi.spyOn(fs, 'writeFile').mockRejectedValue(new Error('disk full'));
    await new UICoverageTrackerStorage({ settings }).saveElementResult(makeResult());
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('disk full'));
  });
});

describe('clear', () => {
  test('does not create a missing directory', async ({ settings }) => {
    await new UICoverageTrackerStorage({ settings }).clear();
    await expect(fs.stat(settings.resultsDir)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  test('removes only top-level scenario result files', async ({ settings }) => {
    const storage = new UICoverageTrackerStorage({ settings });
    for (const { name, result } of contexts) await storage.save({ context: name, result });
    await fs.writeFile(path.join(settings.resultsDir, 'bad-element.json'), '{');
    await fs.writeFile(path.join(settings.resultsDir, 'keep.json'), '{}');
    await fs.writeFile(path.join(settings.resultsDir, 'notes.txt'), 'keep');
    await fs.mkdir(path.join(settings.resultsDir, 'nested-element.json'));
    await fs.writeFile(path.join(settings.resultsDir, 'nested-element.json/keep.json'), '{}');
    await storage.clear();
    expect(await fs.readdir(settings.resultsDir)).toEqual(['keep.json', 'nested-element.json', 'notes.txt']);
    expect(await fs.readFile(path.join(settings.resultsDir, 'nested-element.json/keep.json'), 'utf8')).toBe('{}');
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Removed 5 coverage files'));
  });
  test('preserves configured history and reports including aliases', async ({ settings }) => {
    settings.historyFile = path.join(settings.resultsDir, 'history-scenario.json');
    settings.jsonReportFile = path.join(settings.resultsDir, 'report-element.json');
    settings.htmlReportFile = path.join(settings.resultsDir, 'report-page.json');
    await fs.mkdir(settings.resultsDir);
    for (const file of [settings.historyFile, settings.jsonReportFile, settings.htmlReportFile])
      await fs.writeFile(file, 'keep');
    await fs.symlink(settings.historyFile, path.join(settings.resultsDir, 'alias-scenario.json'));
    const storage = new UICoverageTrackerStorage({ settings });
    await storage.saveElementResult(makeResult());
    await storage.clear();
    expect(await fs.readdir(settings.resultsDir)).toHaveLength(4);
    for (const file of [settings.historyFile, settings.jsonReportFile, settings.htmlReportFile])
      expect(await fs.readFile(file, 'utf8')).toBe('keep');
  });
  test('works with disabled history and reports', async ({ settings }) => {
    settings.historyFile = null;
    settings.jsonReportFile = null;
    settings.htmlReportFile = null;
    const storage = new UICoverageTrackerStorage({ settings });
    await storage.saveElementResult(makeResult());
    await storage.clear();
    expect(await fs.readdir(settings.resultsDir)).toEqual([]);
  });
  test('rejects a results path that is a file', async ({ settings }) => {
    await fs.writeFile(settings.resultsDir, '{}');
    await expect(new UICoverageTrackerStorage({ settings }).clear()).rejects.toThrow('not a directory');
  });
  test('propagates directory access errors', async ({ settings }) => {
    vi.spyOn(fs, 'stat').mockRejectedValue(Object.assign(new Error('permission denied'), { code: 'EACCES' }));
    await expect(new UICoverageTrackerStorage({ settings }).clear()).rejects.toThrow('permission denied');
  });
  test('reports removal failures with the affected path', async ({ settings }) => {
    const storage = new UICoverageTrackerStorage({ settings });
    await storage.saveElementResult(makeResult());
    vi.spyOn(fs, 'unlink').mockRejectedValue(new Error('permission denied'));
    await expect(storage.clear()).rejects.toThrow('Failed to remove coverage result');
    expect(await fs.readdir(settings.resultsDir)).toHaveLength(1);
  });
});
