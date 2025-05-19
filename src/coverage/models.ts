import { ActionCoverage, ActionType } from '../tools/actions';
import { AppHistory, ScenarioHistory } from '../history/models';
import { Page, PagePriority, ScenarioName, Selector } from '../tools/types';
import { SelectorType } from '../tools/selector';

export interface ScenarioCoverageStep {
  selector: Selector;
  timestamp: number;
  actionType: ActionType;
  selectorType: SelectorType;
}

export interface ScenarioCoverage {
  url: string | number;
  name: ScenarioName;
  steps: ScenarioCoverageStep[];
  actions: ActionCoverage[];
  history: ScenarioHistory[];
}

export interface PageCoverageNode {
  url: string;
  page: Page;
  priority: PagePriority;
  scenarios: ScenarioName[];
}

export interface PageCoverageEdge {
  count: number;
  toPage: Page;
  fromPage: Page;
  scenarios: ScenarioName[];
}

export interface PagesCoverage {
  nodes: PageCoverageNode[];
  edges: PageCoverageEdge[];
}

export interface AppCoverage {
  pages: PagesCoverage;
  history: AppHistory[];
  scenarios: ScenarioCoverage[];
}
