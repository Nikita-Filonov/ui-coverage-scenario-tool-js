import { ActionType } from '../tools/actions';
import { AppKey, ScenarioName } from '../tools/types';

export interface ActionHistory {
  count: number;
  actionType: ActionType;
}

export interface ScenarioHistory {
  actions: ActionHistory[];
  createdAt: Date;
}

export interface AppHistory {
  actions: ActionHistory[];
  createdAt: Date;
  totalActions: number;
  totalElements: number;
}

export interface AppHistoryState {
  total: AppHistory[];
  scenarios: Record<ScenarioName, ScenarioHistory[]>;
}

export interface CoverageHistoryState {
  apps: Record<AppKey, AppHistoryState>;
}

