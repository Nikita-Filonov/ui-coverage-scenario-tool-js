import { ActionCoverage, ActionType } from '../tools/actions';
import { AppHistory, ScenarioHistory } from '../history/models';
import { ScenarioName, Selector } from '../tools/types';
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

export interface AppCoverage {
  history: AppHistory[];
  scenarios: ScenarioCoverage[];
}


