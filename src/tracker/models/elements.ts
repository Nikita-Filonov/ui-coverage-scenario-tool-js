import { AppKey, ScenarioName, Selector } from '../../tools/types';
import { ActionType } from '../../tools/actions';
import { SelectorType } from '../../tools/selector';

export interface CoverageElementResult {
  app: AppKey;
  selector: Selector;
  scenario: ScenarioName;
  timestamp: number;
  actionType: ActionType;
  selectorType: SelectorType;
}

export class CoverageElementResultList {
  readonly results: CoverageElementResult[];

  constructor({ results }: { results: CoverageElementResult[] }) {
    this.results = results;
  }

  filter({ app, scenario }: { app?: AppKey; scenario?: ScenarioName }): CoverageElementResultList {
    const filtered = this.results.filter(
      (result) =>
        (!app || result.app.toLowerCase() === app.toLowerCase()) &&
        (!scenario || result.scenario.toLowerCase() === scenario.toLowerCase())
    );
    return new CoverageElementResultList({ results: filtered });
  }

  get groupedByAction(): Map<ActionType, CoverageElementResultList> {
    return this.groupBy((r) => r.actionType);
  }

  get groupedBySelector(): Map<string, CoverageElementResultList> {
    return this.groupBy((r) => `${encodeURIComponent(r.selector)}|${r.selectorType}`);
  }

  get totalActions(): number {
    return this.results.length;
  }

  get totalSelectors(): number {
    return this.groupedBySelector.size;
  }

  countAction(actionType: ActionType): number {
    return this.results.filter((r) => r.actionType === actionType).length;
  }

  private groupBy<K>(keyGetter: (r: CoverageElementResult) => K): Map<K, CoverageElementResultList> {
    const map = new Map<K, CoverageElementResult[]>();
    for (const result of this.results) {
      const key = keyGetter(result);
      const results = map.get(key) || [];
      results.push(result);
      map.set(key, results);
    }

    const resultMap = new Map<K, CoverageElementResultList>();
    for (const [key, results] of map.entries()) {
      resultMap.set(key, new CoverageElementResultList({ results }));
    }

    return resultMap;
  }
}
