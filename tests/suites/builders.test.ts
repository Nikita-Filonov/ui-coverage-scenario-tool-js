import { describe, expect, vi } from 'vitest';
import { makeResult, makePage, makeScenario, makeTransition, test } from '../fixtures';
import { ActionType, SelectorType } from '../../src';
import { CoverageElementResultList } from '../../src/tracker/models/elements';
import { CoveragePageResultList } from '../../src/tracker/models/pages';
import { CoverageScenarioResultList } from '../../src/tracker/models/scenarios';
import { CoverageTransitionResultList } from '../../src/tracker/models/transitions';
import { UICoverageBuilder } from '../../src/coverage/builder';
import { UICoverageHistoryBuilder } from '../../src/history/builder';

const actions = [{ actionType: ActionType.Click, count: 2 }];

describe('history builder', () => {
  test('sorts and retains the newest app and scenario history without mutating inputs', ({ settings }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'));
    settings.historyRetentionLimit = 2;
    const first = { actions, createdAt: new Date('2026-01-01T00:00:00Z'), totalActions: 2, totalElements: 1 };
    const second = { ...first, createdAt: new Date('2026-01-02T00:00:00Z') };
    const history = { total: [second, first], scenarios: { Login: [second, first] } };
    const builder = new UICoverageHistoryBuilder({ settings, history });
    const appHistory = builder.getAppHistory({ actions, totalActions: 2, totalElements: 1 });
    const scenarioHistory = builder.getScenarioHistory({ actions, name: 'Login' });
    expect(appHistory.map((item) => item.createdAt.toISOString())).toEqual([
      '2026-01-02T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z'
    ]);
    expect(scenarioHistory).toHaveLength(2);
    expect(scenarioHistory[1]).toEqual({ actions, createdAt: new Date() });
    expect(history.total).toEqual([second, first]);
  });
  test('does not append history for an empty run', ({ settings }) => {
    const history = { total: [{ actions, createdAt: new Date(), totalActions: 2, totalElements: 1 }], scenarios: {} };
    const builder = new UICoverageHistoryBuilder({ settings, history });
    expect(builder.getAppHistory({ actions: [], totalActions: 0, totalElements: 0 })).toBe(history.total);
    expect(builder.getScenarioHistory({ actions: [], name: 'Missing' })).toEqual([]);
  });
  test('returns empty histories when storage is disabled', ({ settings }) => {
    settings.historyFile = null;
    const builder = new UICoverageHistoryBuilder({ settings, history: { total: [], scenarios: {} } });
    expect(builder.getAppHistory({ actions, totalActions: 2, totalElements: 1 })).toEqual([]);
    expect(builder.getScenarioHistory({ actions, name: 'Login' })).toEqual([]);
  });
});

describe('coverage builder', () => {
  test('aggregates actions, scenarios, page metadata and directional transitions', ({ settings }) => {
    const elementResultList = new CoverageElementResultList({
      results: [
        makeResult(),
        makeResult(),
        makeResult({ actionType: ActionType.Fill }),
        makeResult({ selectorType: SelectorType.XPath }),
        makeResult({ scenario: 'Logout', selector: '#logout' })
      ]
    });
    const pageResultList = new CoveragePageResultList({
      results: [
        makePage(),
        makePage({ priority: 99 }),
        makePage({ scenario: 'Logout' }),
        makePage({ page: 'Home', priority: 2, url: '/' })
      ]
    });
    const transitionResultList = new CoverageTransitionResultList({
      results: [
        makeTransition(),
        makeTransition(),
        makeTransition({ scenario: 'Logout' }),
        makeTransition({ fromPage: 'Home', toPage: 'Login', scenario: 'Logout' })
      ]
    });
    const scenarioResultList = new CoverageScenarioResultList({
      results: [makeScenario(), makeScenario({ name: 'Logout', url: 'https://tms.example/2' })]
    });
    const historyBuilder = new UICoverageHistoryBuilder({ settings, history: { total: [], scenarios: {} } });
    const report = new UICoverageBuilder({
      elementResultList,
      pageResultList,
      transitionResultList,
      scenarioResultList,
      historyBuilder
    }).build();
    expect(report.scenarios).toHaveLength(2);
    expect(report.scenarios[0]).toMatchObject({
      name: 'Login',
      url: null,
      actions: [
        { actionType: ActionType.Fill, count: 1 },
        { actionType: ActionType.Click, count: 3 }
      ]
    });
    expect(report.scenarios[0].steps).toHaveLength(4);
    expect(report.scenarios[0].steps[3].selectorType).toBe(SelectorType.XPath);
    expect(report.scenarios[1].steps).toHaveLength(1);
    expect(report.scenarios[1].history[0].actions).toEqual([{ actionType: ActionType.Click, count: 1 }]);
    expect(report.history[0]).toMatchObject({
      totalActions: 5,
      totalElements: 3,
      actions: [
        { actionType: ActionType.Click, count: 4 },
        { actionType: ActionType.Fill, count: 1 }
      ]
    });
    expect(report.pages.nodes).toEqual([
      { page: 'Login', url: '/login', priority: 1, scenarios: ['Login', 'Logout'] },
      { page: 'Home', url: '/', priority: 2, scenarios: ['Login'] }
    ]);
    expect(report.pages.edges).toEqual([
      { fromPage: 'Login', toPage: 'Home', count: 3, scenarios: ['Login', 'Logout'] },
      { fromPage: 'Home', toPage: 'Login', count: 1, scenarios: ['Logout'] }
    ]);
  });
  test('produces empty coverage for an app without results', ({ settings }) => {
    const historyBuilder = new UICoverageHistoryBuilder({ settings, history: { total: [], scenarios: {} } });
    expect(
      new UICoverageBuilder({
        historyBuilder,
        elementResultList: new CoverageElementResultList({ results: [] }),
        pageResultList: new CoveragePageResultList({ results: [] }),
        scenarioResultList: new CoverageScenarioResultList({ results: [] }),
        transitionResultList: new CoverageTransitionResultList({ results: [] })
      }).build()
    ).toEqual({ history: [], scenarios: [], pages: { nodes: [], edges: [] } });
  });
  test('includes every supported action and scenarios without steps', ({ settings }) => {
    const historyBuilder = new UICoverageHistoryBuilder({ settings, history: { total: [], scenarios: {} } });
    const report = new UICoverageBuilder({
      historyBuilder,
      elementResultList: new CoverageElementResultList({
        results: Object.values(ActionType).map((actionType) => makeResult({ actionType }))
      }),
      pageResultList: new CoveragePageResultList({ results: [] }),
      scenarioResultList: new CoverageScenarioResultList({
        results: [makeScenario(), makeScenario({ name: 'Empty' })]
      }),
      transitionResultList: new CoverageTransitionResultList({ results: [] })
    }).build();
    expect(report.scenarios[0].actions.map((action) => action.actionType)).toEqual(Object.values(ActionType));
    expect(report.history[0].totalActions).toBe(Object.values(ActionType).length);
    expect(report.scenarios[1]).toEqual({ name: 'Empty', url: null, actions: [], steps: [], history: [] });
  });
});
