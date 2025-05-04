import { UICoverageTrackerStorage } from './storage';
import { ActionType } from '../tools/actions';
import { SelectorType } from '../tools/selector';
import { Settings } from '../config/models';
import { getSettings } from '../config/core';
import { CoverageScenarioResult } from './models';
import { getLogger } from '../tools/logger';

const logger = getLogger('UI_COVERAGE_TRACKER');

type UICoverageTrackerProps = {
  app: string
  settings?: Settings
}

type StartScenarioProps = {
  url: string | null
  name: string
}

type TrackCoverageProps = {
  selector: string,
  actionType: ActionType,
  selectorType: SelectorType
}

export class UICoverageTracker {
  private app: string;
  private storage: UICoverageTrackerStorage;
  private scenario: CoverageScenarioResult | null;
  private settings: Settings;

  constructor({ app, settings }: UICoverageTrackerProps) {
    this.app = app;
    this.settings = settings || getSettings();

    this.storage = new UICoverageTrackerStorage({ settings: this.settings });
    this.scenario = null;
  }

  startScenario({ url, name }: StartScenarioProps): void {
    this.scenario = { url: url, app: this.app, name: name };
  }

  async endScenario(): Promise<void> {
    if (this.scenario) {
      await this.storage.saveScenarioResult(this.scenario);
    }

    this.scenario = null;
  }

  async trackCoverage({ selector, actionType, selectorType }: TrackCoverageProps): Promise<void> {
    if (!this.scenario) {
      logger.warning('No active scenario. Did you forget to call start_scenario?');
      return;
    }

    await this.storage.saveElementResult({
      app: this.app,
      scenario: this.scenario.name,
      selector,
      timestamp: Date.now(),
      actionType,
      selectorType
    });
  }
}
