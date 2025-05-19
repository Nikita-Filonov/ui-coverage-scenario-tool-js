import { getLogger } from '../tools/logger';
import { UICoverageTrackerStorage } from '../tracker/storage';
import { UICoverageHistoryStorage } from '../history/storage';
import { CoverageReportState } from '../reports/models';
import { UICoverageBuilder } from '../coverage/builder';
import { UICoverageHistoryBuilder } from '../history/builder';
import { UIReportsStorage } from '../reports/storage';
import { getSettings } from '../config/core';

const logger = getLogger('SAVE_REPORT');

export const saveReport = async () => {
  logger.info('Starting to save the report');

  const settings = getSettings();

  const reportsStorage = new UIReportsStorage({ settings });
  const trackerStorage = new UICoverageTrackerStorage({ settings });
  const historyStorage = new UICoverageHistoryStorage({ settings });

  const reportState: CoverageReportState = {
    config: { apps: settings.apps },
    createdAt: new Date(),
    appsCoverage: {}
  };
  const historyState = await historyStorage.load();
  const pageResults = await trackerStorage.loadPageResults();
  const elementResults = await trackerStorage.loadElementResults();
  const scenarioResults = await trackerStorage.loadScenarioResults();
  const transitionResults = await trackerStorage.loadTransitionResults();
  for (const app of settings.apps) {
    const pageResultList = pageResults.filter({ app: app.key });
    const elementResultList = elementResults.filter({ app: app.key });
    const scenarioResultList = scenarioResults.filter({ app: app.key });
    const transitionResultList = transitionResults.filter({ app: app.key });

    const history = historyState.apps[app.key] || { total: [], scenarios: {} };
    const historyBuilder = new UICoverageHistoryBuilder({ history, settings });
    const coverageBuilder = new UICoverageBuilder({
      historyBuilder,
      pageResultList,
      elementResultList,
      scenarioResultList,
      transitionResultList
    });
    reportState.appsCoverage[app.key] = coverageBuilder.build();
  }

  await historyStorage.saveFromReport(reportState);
  await reportsStorage.saveJsonReport(reportState);
  await reportsStorage.saveHtmlReport(reportState);

  logger.info('Report saving process completed');
};
