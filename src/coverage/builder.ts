import { ActionCoverage, ActionType } from '../tools/actions';
import {
  AppCoverage,
  PageCoverageEdge,
  PageCoverageNode,
  PagesCoverage,
  ScenarioCoverage,
  ScenarioCoverageStep
} from './models';
import { UICoverageHistoryBuilder } from '../history/builder';
import { ActionHistory } from '../history/models';
import { CoveragePageResultList } from '../tracker/models/pages';
import { CoverageTransitionResultList } from '../tracker/models/transitions';
import { CoverageElementResultList } from '../tracker/models/elements';
import { CoverageScenarioResult, CoverageScenarioResultList } from '../tracker/models/scenarios';

type UICoverageBuilderProps = {
  historyBuilder: UICoverageHistoryBuilder;
  pageResultList: CoveragePageResultList;
  elementResultList: CoverageElementResultList;
  scenarioResultList: CoverageScenarioResultList;
  transitionResultList: CoverageTransitionResultList;
};

type BuildScenarioCoverageProps = {
  scenario: CoverageScenarioResult;
};

export class UICoverageBuilder {
  private historyBuilder: UICoverageHistoryBuilder;
  private pageResultList: CoveragePageResultList;
  private elementResultList: CoverageElementResultList;
  private scenarioResultList: CoverageScenarioResultList;
  private transitionResultList: CoverageTransitionResultList;

  constructor({
    historyBuilder,
    pageResultList,
    elementResultList,
    scenarioResultList,
    transitionResultList
  }: UICoverageBuilderProps) {
    this.historyBuilder = historyBuilder;
    this.pageResultList = pageResultList;
    this.elementResultList = elementResultList;
    this.scenarioResultList = scenarioResultList;
    this.transitionResultList = transitionResultList;
  }

  private buildPagesCoverage(): PagesCoverage {
    const nodes: PageCoverageNode[] = this.pageResultList.unique().results.map((result) => ({
      url: result.url,
      page: result.page,
      priority: result.priority,
      scenarios: this.pageResultList.findScenarios({ page: result.page })
    }));

    const edges: PageCoverageEdge[] = this.transitionResultList.unique().results.map((result) => ({
      count: this.transitionResultList.countTransitions(result),
      toPage: result.toPage,
      fromPage: result.fromPage,
      scenarios: this.transitionResultList.findScenarios(result)
    }));

    return { nodes, edges };
  }

  private buildScenarioCoverage({ scenario }: BuildScenarioCoverageProps): ScenarioCoverage {
    const elements = this.elementResultList.filter({ scenario: scenario.name });

    const steps: ScenarioCoverageStep[] = elements.results.map((element) => ({
      selector: element.selector,
      timestamp: element.timestamp,
      actionType: element.actionType,
      selectorType: element.selectorType
    }));

    const actions: ActionCoverage[] = Object.values(ActionType)
      .map((actionType) => ({ actionType, count: elements.countAction(actionType) }))
      .filter((a) => a.count > 0);

    const history = this.historyBuilder.getScenarioHistory({ name: scenario.name, actions });

    return { url: scenario.url, name: scenario.name, steps, actions, history };
  }

  build(): AppCoverage {
    const pages = this.buildPagesCoverage();

    const actions: ActionHistory[] = [];
    for (const [action, results] of this.elementResultList.groupedByAction.entries()) {
      if (results.totalActions > 0) {
        actions.push({ actionType: action, count: results.totalActions });
      }
    }

    const scenarios: ScenarioCoverage[] = this.scenarioResultList.results.map((scenario) =>
      this.buildScenarioCoverage({ scenario })
    );

    const history = this.historyBuilder.getAppHistory({
      actions,
      totalActions: this.elementResultList.totalActions,
      totalElements: this.elementResultList.totalSelectors
    });

    return { pages, history, scenarios };
  }
}
