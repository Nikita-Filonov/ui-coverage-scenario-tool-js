import { AppKey, Page, ScenarioName } from '../../tools/types';

export interface CoverageTransitionResult {
  app: AppKey;
  toPage: Page;
  scenario: ScenarioName;
  fromPage: Page;
}

export class CoverageTransitionResultList {
  readonly results: CoverageTransitionResult[];

  constructor({ results }: { results: CoverageTransitionResult[] }) {
    this.results = results;
  }

  filter({ app }: { app?: AppKey }): CoverageTransitionResultList {
    const filtered = this.results.filter((result) => !app || result.app.toLowerCase() === app.toLowerCase());
    return new CoverageTransitionResultList({ results: filtered });
  }

  unique(): CoverageTransitionResultList {
    const map = new Map<string, CoverageTransitionResult>();
    for (const result of this.results) {
      const key = `${result.fromPage}→${result.toPage}`;
      if (!map.has(key)) {
        map.set(key, result);
      }
    }

    return new CoverageTransitionResultList({ results: Array.from(map.values()) });
  }

  findScenarios({ toPage, fromPage }: { toPage: Page; fromPage: Page }): ScenarioName[] {
    const scenarios = this.results
      .filter((result) => result.toPage === toPage && result.fromPage === fromPage)
      .map((result) => result.scenario);

    return Array.from(new Set(scenarios));
  }

  countTransitions({ toPage, fromPage }: { toPage: Page; fromPage: Page }): number {
    return this.results.filter((result) => result.toPage === toPage && result.fromPage === fromPage).length;
  }
}
