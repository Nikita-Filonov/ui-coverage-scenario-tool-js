import { UICoverageTrackerStorage } from './storage';
import { ActionType } from '../tools/actions';
import { SelectorType } from '../tools/selector';
import { Settings } from '../config/models';
import { getSettings } from '../config/core';
import { getLogger } from '../tools/logger';
import { CoverageScenarioResult } from './models/scenarios';

const logger = getLogger('UI_COVERAGE_TRACKER');

type UICoverageTrackerProps = {
  app: string;
  settings?: Settings;
};

type StartScenarioProps = {
  url: string | null;
  name: string;
};

type TrackPageProps = {
  url: string;
  page: string;
  priority: number;
};

type TrackElementProps = {
  selector: string;
  actionType: ActionType;
  selectorType: SelectorType;
};

type TrackTransitionProps = {
  toPage: string;
  fromPage: string;
};

export class UICoverageTracker {
  private readonly app: string;
  private readonly storage: UICoverageTrackerStorage;
  private readonly settings: Settings;
  private scenario: CoverageScenarioResult | null;

  constructor({ app, settings }: UICoverageTrackerProps) {
    this.app = app;
    this.settings = settings || getSettings();

    this.storage = new UICoverageTrackerStorage({ settings: this.settings });
    this.scenario = null;
  }

  startScenario({ url, name }: StartScenarioProps): void {
    this.scenario = { url, app: this.app, name };
  }

  async endScenario(): Promise<void> {
    if (this.scenario) {
      await this.storage.saveScenarioResult(this.scenario);
    }

    this.scenario = null;
  }

  /**
   * @deprecated Method is deprecated, use `trackElement` instead.
   */
  async trackCoverage(props: TrackElementProps): Promise<void> {
    logger.warning('Method trackCoverage() is deprecated. Use trackElement() instead.');
    await this.trackElement(props);
  }

  async trackPage({ url, page, priority }: TrackPageProps): Promise<void> {
    if (!this.scenario) {
      logger.warning('No active scenario. Did you forget to call startScenario? Calling: trackPage');
      return;
    }

    await this.storage.savePageResult({
      app: this.app,
      url: url,
      page: page,
      priority: priority,
      scenario: this.scenario.name
    });
  }

  async trackElement({ selector, actionType, selectorType }: TrackElementProps): Promise<void> {
    if (!this.scenario) {
      logger.warning('No active scenario. Did you forget to call startScenario? Calling: trackElement');
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

  async trackTransition({ toPage, fromPage }: TrackTransitionProps): Promise<void> {
    if (!this.scenario) {
      logger.warning('No active scenario. Did you forget to call startScenario? Calling: trackTransition');
      return;
    }

    await this.storage.saveTransitionResult({
      app: this.app,
      toPage,
      scenario: this.scenario.name,
      fromPage
    });
  }
}
