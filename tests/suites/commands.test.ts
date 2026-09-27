import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, vi } from 'vitest';
import { app, makeResult, test } from '../fixtures';
import { UICoverageTracker, ActionType } from '../../src';
import { UICoverageTrackerStorage } from '../../src/tracker/storage';
import { createProgram } from '../../src/commands/core';
import { version } from '../../package.json';

beforeEach(() => {
  for (const key of Object.keys(process.env).filter((name) => name.startsWith('UI_COVERAGE_SCENARIO_')))
    vi.stubEnv(key, undefined);
});
const run = (command: string) => createProgram().parseAsync([command], { from: 'user' });

const record = async (tracker: UICoverageTracker, actionType = ActionType.Click) => {
  tracker.startScenario({ name: 'Login', url: null });
  await tracker.trackPage({ page: 'Login', url: '/login', priority: 1 });
  await tracker.trackPage({ page: 'Home', url: '/', priority: 2 });
  await tracker.trackElement(makeResult({ actionType }));
  await tracker.trackTransition({ fromPage: 'Login', toPage: 'Home' });
  await tracker.endScenario();
};

describe('CLI', () => {
  test('registers cleanup last and reports the package version', () => {
    const program = createProgram();
    expect(program.commands.map((command) => command.name())).toEqual(['save-report', 'print-config', 'clear-results']);
    expect(program.version()).toBe(version);
    expect(program.name()).toBe('ui-coverage-scenario-tool');
  });
  test('prints the resolved configuration', async ({ directory }) => {
    vi.spyOn(process, 'cwd').mockReturnValue(directory);
    await run('print-config');
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining(path.join(directory, 'coverage-results')));
  });
  test('clears results using the configured directory', async ({ directory, settings }) => {
    vi.spyOn(process, 'cwd').mockReturnValue(directory);
    await fs.writeFile(path.join(directory, 'ui-coverage-scenario.config.json'), JSON.stringify(settings));
    await new UICoverageTrackerStorage({ settings }).saveElementResult(makeResult());
    await run('clear-results');
    expect(await fs.readdir(settings.resultsDir)).toEqual([]);
  });
  test('propagates cleanup errors', async ({ directory, settings }) => {
    vi.spyOn(process, 'cwd').mockReturnValue(directory);
    await fs.writeFile(path.join(directory, 'ui-coverage-scenario.config.json'), JSON.stringify(settings));
    await fs.writeFile(settings.resultsDir, '{}');
    await expect(run('clear-results')).rejects.toThrow('not a directory');
  });
  test('generates reports for multiple apps and preserves history between clean runs', async ({
    directory,
    settings
  }) => {
    vi.spyOn(process, 'cwd').mockReturnValue(directory);
    settings.apps = [app, { ...app, key: 'admin' }, { ...app, key: 'empty' }];
    settings.historyRetentionLimit = 2;
    await fs.writeFile(path.join(directory, 'ui-coverage-scenario.config.json'), JSON.stringify(settings));
    const shop = new UICoverageTracker({ app: 'SHOP', settings });
    const admin = new UICoverageTracker({ app: 'admin', settings });
    await record(shop);
    await record(admin, ActionType.Fill);
    await run('save-report');
    const first = JSON.parse(await fs.readFile(settings.jsonReportFile!, 'utf8'));
    expect(first.appsCoverage.shop.history[0]).toMatchObject({ totalActions: 1, totalElements: 1 });
    expect(first.appsCoverage.shop.scenarios[0]).toMatchObject({ name: 'Login', url: null });
    expect(first.appsCoverage.shop.pages.nodes).toHaveLength(2);
    expect(first.appsCoverage.shop.pages.edges[0]).toMatchObject({
      fromPage: 'Login',
      toPage: 'Home',
      count: 1,
      scenarios: ['Login']
    });
    expect(first.appsCoverage.admin.scenarios[0].actions).toEqual([{ actionType: ActionType.Fill, count: 1 }]);
    expect(first.appsCoverage.empty).toEqual({ history: [], scenarios: [], pages: { nodes: [], edges: [] } });
    const html = await fs.readFile(settings.htmlReportFile!, 'utf8');
    expect(JSON.parse(html.match(/<script id="state" type="application\/json">([\s\S]*?)<\/script>/)![1])).toEqual(
      first
    );
    for (let i = 0; i < 2; i++) {
      await run('clear-results');
      await record(shop);
      await run('save-report');
    }
    const last = JSON.parse(await fs.readFile(settings.jsonReportFile!, 'utf8'));
    expect(last.appsCoverage.shop.history).toHaveLength(2);
    expect(last.appsCoverage.shop.history.at(-1).totalActions).toBe(1);
    expect(last.appsCoverage.shop.scenarios[0].history).toHaveLength(2);
    expect(last.appsCoverage.admin.history).toHaveLength(1);
  });
  test('aggregates results until explicit cleanup', async ({ directory, settings }) => {
    vi.spyOn(process, 'cwd').mockReturnValue(directory);
    await fs.writeFile(path.join(directory, 'ui-coverage-scenario.config.json'), JSON.stringify(settings));
    const tracker = new UICoverageTracker({ app: 'shop', settings });
    await record(tracker);
    await run('save-report');
    await record(tracker);
    await run('save-report');
    const state = JSON.parse(await fs.readFile(settings.jsonReportFile!, 'utf8'));
    expect(state.appsCoverage.shop.history.at(-1).totalActions).toBe(2);
    expect(state.appsCoverage.shop.pages.edges[0].count).toBe(2);
  });
  test('supports history and reports inside the results directory', async ({ directory, settings }) => {
    vi.spyOn(process, 'cwd').mockReturnValue(directory);
    settings.historyFile = path.join(settings.resultsDir, 'history-scenario.json');
    settings.jsonReportFile = path.join(settings.resultsDir, 'report-element.json');
    await fs.writeFile(path.join(directory, 'ui-coverage-scenario.config.json'), JSON.stringify(settings));
    const tracker = new UICoverageTracker({ app: 'shop', settings });
    await record(tracker);
    await run('save-report');
    const history = await fs.readFile(settings.historyFile, 'utf8');
    await run('clear-results');
    expect(await fs.readFile(settings.historyFile, 'utf8')).toBe(history);
    await record(tracker);
    await run('save-report');
    const state = JSON.parse(await fs.readFile(settings.jsonReportFile, 'utf8'));
    expect(state.appsCoverage.shop.history).toHaveLength(2);
    expect(state.appsCoverage.shop.history.at(-1).totalActions).toBe(1);
  });
});
