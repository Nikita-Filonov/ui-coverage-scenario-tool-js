import { AppKey, ScenarioName } from '../../tools/types';

export interface CoverageScenarioResult {
  app: AppKey;
  url: string | null;
  name: ScenarioName;
}

export class CoverageScenarioResultList {
  readonly results: CoverageScenarioResult[];

  constructor({ results }: { results: CoverageScenarioResult[] }) {
    this.results = results;
  }

  filter({ app }: { app?: AppKey }): CoverageScenarioResultList {
    const filtered = this.results.filter((result) => !app || result.app.toLowerCase() === app.toLowerCase());
    return new CoverageScenarioResultList({ results: filtered });
  }
}
