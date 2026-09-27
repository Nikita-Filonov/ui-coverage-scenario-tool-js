import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test as base } from 'vitest';
import { Settings } from '../src/config/models';
import { CoverageElementResult } from '../src/tracker/models/elements';
import { CoveragePageResult } from '../src/tracker/models/pages';
import { CoverageScenarioResult } from '../src/tracker/models/scenarios';
import { CoverageTransitionResult } from '../src/tracker/models/transitions';
import { ActionType, SelectorType } from '../src';
import { CoverageReportState } from '../src/reports/models';

export const app = { key: 'shop', name: 'Shop', url: 'https://shop.example' };
export const makeResult = (overrides: Partial<CoverageElementResult> = {}): CoverageElementResult => ({
  app: app.key,
  scenario: 'Login',
  selector: '#login',
  timestamp: 1000,
  actionType: ActionType.Click,
  selectorType: SelectorType.CSS,
  ...overrides
});
export const makePage = (overrides: Partial<CoveragePageResult> = {}): CoveragePageResult => ({
  app: app.key,
  scenario: 'Login',
  page: 'Login',
  url: '/login',
  priority: 1,
  ...overrides
});
export const makeScenario = (overrides: Partial<CoverageScenarioResult> = {}): CoverageScenarioResult => ({
  app: app.key,
  name: 'Login',
  url: null,
  ...overrides
});
export const makeTransition = (overrides: Partial<CoverageTransitionResult> = {}): CoverageTransitionResult => ({
  app: app.key,
  scenario: 'Login',
  fromPage: 'Login',
  toPage: 'Home',
  ...overrides
});
export const makeReport = (overrides: Partial<CoverageReportState> = {}): CoverageReportState => ({
  config: { apps: [app] },
  createdAt: new Date('2026-01-01T00:00:00Z'),
  appsCoverage: { shop: { history: [], scenarios: [], pages: { nodes: [], edges: [] } } },
  ...overrides
});

export const test = base.extend<{ directory: string; settings: Settings }>({
  directory: async ({}, use) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ui-coverage-scenario-js-'));
    try {
      await use(directory);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
  settings: async ({ directory }, use) => {
    const htmlReportTemplateFile = path.join(directory, 'template.html');
    await fs.writeFile(htmlReportTemplateFile, '<html><script id="state" type="application/json">{}</script></html>');
    await use({
      apps: [app],
      resultsDir: path.join(directory, 'results'),
      historyFile: path.join(directory, 'reports/history.json'),
      historyRetentionLimit: 30,
      htmlReportFile: path.join(directory, 'reports/index.html'),
      jsonReportFile: path.join(directory, 'reports/coverage.json'),
      htmlReportTemplateFile
    });
  }
});
