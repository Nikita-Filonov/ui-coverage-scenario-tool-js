import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'node:crypto';
import { isPageResult, isElementResult, isScenarioResult, isTransitionResult } from './models/validation';
import { getLogger } from '../tools/logger';
import { Settings } from '../config/models';
import { isPathExists } from '../tools/files';
import { CoveragePageResult, CoveragePageResultList } from './models/pages';
import { CoverageElementResult, CoverageElementResultList } from './models/elements';
import { CoverageScenarioResult, CoverageScenarioResultList } from './models/scenarios';
import { CoverageTransitionResult, CoverageTransitionResultList } from './models/transitions';

const logger = getLogger('UI_COVERAGE_TRACKER_STORAGE');

type ResultListInterface<Result, List> = new (props: { results: Result[] }) => List;

type LoadProps<Result, List> = {
  context: string;
  resultList: ResultListInterface<Result, List>;
  isResult: (value: unknown) => value is Result;
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

  async load<Result, List>(props: LoadProps<Result, List>): Promise<List> {
    const { context, resultList, isResult } = props;
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
          const result: unknown = JSON.parse(json);
          if (!isResult(result)) throw new Error('Invalid coverage result');
          results.push(result);
        } catch (error) {
          logger.warning(`Failed to parse file ${fileName}: ${error}`);
        }
      }
    }

    logger.info(`Loaded ${results.length} coverage files from directory: ${resultsDir}`);
    return new resultList({ results });
  }

  async clear(): Promise<void> {
    const resultsDir = this.settings.resultsDir;
    let directoryStats;
    try {
      directoryStats = await fs.stat(resultsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info(`Results directory does not exist: ${resultsDir}`);
        return;
      }
      throw error;
    }

    if (!directoryStats.isDirectory()) {
      throw new Error(`Results path is not a directory: ${resultsDir}`);
    }

    const protectedFiles = new Set<string>();
    for (const file of [this.settings.historyFile, this.settings.jsonReportFile, this.settings.htmlReportFile]) {
      if (file && (await isPathExists(file))) protectedFiles.add(await fs.realpath(file));
    }

    let removed = 0;
    for (const fileName of await fs.readdir(resultsDir)) {
      if (!/-(page|element|scenario|transition)\.json$/.test(fileName)) continue;
      const file = path.join(resultsDir, fileName);
      if (!(await fs.stat(file)).isFile() || protectedFiles.has(await fs.realpath(file))) continue;
      try {
        await fs.unlink(file);
        removed += 1;
      } catch (error) {
        throw new Error(`Failed to remove coverage result ${file}: ${error}`, { cause: error });
      }
    }
    logger.info(`Removed ${removed} coverage files from directory: ${resultsDir}`);
  }

  async save<Result>({ result, context }: SaveProps<Result>) {
    const resultsDir = this.settings.resultsDir;

    if (!(await isPathExists(resultsDir))) {
      logger.info(`Results directory does not exist, creating: ${resultsDir}`);
      await fs.mkdir(resultsDir, { recursive: true });
    }

    const file = path.join(resultsDir, `${randomUUID()}-${context}.json`);

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
    return await this.load({ context: 'page', resultList: CoveragePageResultList, isResult: isPageResult });
  }

  async loadElementResults(): Promise<CoverageElementResultList> {
    return await this.load({ context: 'element', resultList: CoverageElementResultList, isResult: isElementResult });
  }

  async loadScenarioResults(): Promise<CoverageScenarioResultList> {
    return await this.load({ context: 'scenario', resultList: CoverageScenarioResultList, isResult: isScenarioResult });
  }

  async loadTransitionResults(): Promise<CoverageTransitionResultList> {
    return await this.load({
      context: 'transition',
      resultList: CoverageTransitionResultList,
      isResult: isTransitionResult
    });
  }
}
