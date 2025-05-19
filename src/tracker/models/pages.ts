import { AppKey, Page, PagePriority, ScenarioName } from '../../tools/types';

export interface CoveragePageResult {
  app: AppKey;
  url: string;
  page: Page;
  priority: PagePriority;
  scenario: ScenarioName;
}

export class CoveragePageResultList {
  readonly results: CoveragePageResult[];

  constructor({ results }: { results: CoveragePageResult[] }) {
    this.results = results;
  }

  filter({ app }: { app?: AppKey }): CoveragePageResultList {
    const filtered = this.results.filter((result) => !app || result.app.toLowerCase() === app.toLowerCase());
    return new CoveragePageResultList({ results: filtered });
  }

  unique(): CoveragePageResultList {
    const map = new Map<string, CoveragePageResult>();
    for (const result of this.results) {
      const key = result.page;
      if (!map.has(key)) {
        map.set(key, result);
      }
    }

    return new CoveragePageResultList({ results: Array.from(map.values()) });
  }

  findScenarios({ page }: { page: Page }): ScenarioName[] {
    const scenarios = this.results.filter((result) => result.page === page).map((result) => result.scenario);
    return Array.from(new Set(scenarios));
  }
}
