import { ActionType } from '../../tools/actions';
import { SelectorType } from '../../tools/selector';
import { CoverageElementResult } from './elements';
import { CoveragePageResult } from './pages';
import { CoverageScenarioResult } from './scenarios';
import { CoverageTransitionResult } from './transitions';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isScenarioContext = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && typeof value.app === 'string' && typeof value.scenario === 'string';

export const isElementResult = (value: unknown): value is CoverageElementResult =>
  isScenarioContext(value) &&
  typeof value.selector === 'string' &&
  typeof value.timestamp === 'number' &&
  Number.isFinite(value.timestamp) &&
  Object.values(ActionType).includes(value.actionType as ActionType) &&
  Object.values(SelectorType).includes(value.selectorType as SelectorType);

export const isPageResult = (value: unknown): value is CoveragePageResult =>
  isScenarioContext(value) &&
  typeof value.url === 'string' &&
  typeof value.page === 'string' &&
  typeof value.priority === 'number' &&
  Number.isFinite(value.priority);

export const isScenarioResult = (value: unknown): value is CoverageScenarioResult =>
  isRecord(value) &&
  typeof value.app === 'string' &&
  typeof value.name === 'string' &&
  (value.url === null || typeof value.url === 'string');

export const isTransitionResult = (value: unknown): value is CoverageTransitionResult =>
  isScenarioContext(value) && typeof value.toPage === 'string' && typeof value.fromPage === 'string';
