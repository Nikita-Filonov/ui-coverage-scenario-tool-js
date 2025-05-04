import { ActionCoverage, ActionType } from '../tools/actions';
import { AppCoverage, ScenarioCoverage, ScenarioCoverageStep } from './models';
import { CoverageElementResultList, CoverageScenarioResult, CoverageScenarioResultList } from '../tracker/models';
import { UICoverageHistoryBuilder } from '../history/builder';
import { ActionHistory } from '../history/models';

type UICoverageBuilderProps = {
  historyBuilder: UICoverageHistoryBuilder
  elementResultList: CoverageElementResultList
  scenarioResultList: CoverageScenarioResultList
}

type BuildScenarioCoverageProps = {
  scenario: CoverageScenarioResult
}

export class UICoverageBuilder {
  private historyBuilder: UICoverageHistoryBuilder;
  private elementResultList: CoverageElementResultList;
  private scenarioResultList: CoverageScenarioResultList;

  constructor({ historyBuilder, elementResultList, scenarioResultList }: UICoverageBuilderProps) {
    this.historyBuilder = historyBuilder;
    this.elementResultList = elementResultList;
    this.scenarioResultList = scenarioResultList;
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

    return { history, scenarios };
  }
}
