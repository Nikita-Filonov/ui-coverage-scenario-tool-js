import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../tools/logger';
import { Settings } from '../config/models';
import { isPathExists } from '../tools/files';
import { CoveragePageResult, CoveragePageResultList } from './models/pages';
import { CoverageElementResult, CoverageElementResultList } from './models/elements';
import { CoverageScenarioResult, CoverageScenarioResultList } from './models/scenarios';
import { CoverageTransitionResult, CoverageTransitionResultList } from './models/transitions';

const logger = getLogger('UI_COVERAGE_TRACKER_STORAGE');

type ResultListInterface<Result> = {
  new ({ results }: { results: Result[] });
};

type LoadProps<Result> = {
  context: string;
  resultList: ResultListInterface<Result>;
};

type SaveProps<Result> = {
  result: Result;
  context: string;
};

export class UICoverageTrackerStorage {
  private settings: Settings;

  constructor({ settings }: { settings: Settings }) {
    this.settings = settings;
  }

  async load<Result, ResultList extends ResultListInterface<Result>>(
    props: LoadProps<Result>
  ): Promise<InstanceType<ResultList>> {
    const { context, resultList } = props;
    const resultsDir = this.settings.resultsDir;

    logger.info(`Loading coverage results from directory: ${resultsDir}`);

    if (!(await isPathExists(resultsDir))) {
      logger.warning(`Results directory does not exist: ${resultsDir}`);
      return new resultList({ results: [] });
    }

    const results: Result[] = [];
    for (const fileName of await fs.readdir(resultsDir)) {
      const file = path.join(resultsDir, fileName);
      const fileStats = await fs.stat(file);

      if (fileStats.isFile() && fileName.endsWith(`-${context}.json`)) {
        try {
          const json = await fs.readFile(file, 'utf-8');
          results.push(JSON.parse(json));
        } catch (error) {
          logger.warning(`Failed to parse file ${fileName}: ${error}`);
        }
      }
    }

    logger.info(`Loaded ${results.length} coverage files from directory: ${resultsDir}`);
    return new resultList({ results });
  }

  async save<Result>({ result, context }: SaveProps<Result>) {
    const resultsDir = this.settings.resultsDir;

    if (!(await isPathExists(resultsDir))) {
      logger.info(`Results directory does not exist, creating: ${resultsDir}`);
      await fs.mkdir(resultsDir, { recursive: true });
    }

    const file = path.join(resultsDir, `${uuidv4()}-${context}.json`);

    try {
      await fs.writeFile(file, JSON.stringify(result), 'utf-8');
    } catch (error) {
      logger.error(`Error saving coverage data to file ${file}: ${error}`);
    }
  }

  async savePageResult(result: CoveragePageResult): Promise<void> {
    await this.save({ context: 'page', result });
  }

  async saveElementResult(result: CoverageElementResult) {
    await this.save({ context: 'element', result });
  }

  async saveScenarioResult(result: CoverageScenarioResult) {
    await this.save({ context: 'scenario', result });
  }

  async saveTransitionResult(result: CoverageTransitionResult) {
    await this.save({ context: 'transition', result });
  }

  async loadPageResults(): Promise<CoveragePageResultList> {
    return await this.load({ context: 'page', resultList: CoveragePageResultList });
  }

  async loadElementResults(): Promise<CoverageElementResultList> {
    return await this.load({ context: 'element', resultList: CoverageElementResultList });
  }

  async loadScenarioResults(): Promise<CoverageScenarioResultList> {
    return await this.load({ context: 'scenario', resultList: CoverageScenarioResultList });
  }

  async loadTransitionResults(): Promise<CoverageTransitionResultList> {
    return await this.load({ context: 'transition', resultList: CoverageTransitionResultList });
  }
}
