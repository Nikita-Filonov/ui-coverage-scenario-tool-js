import { AsyncLocalStorage } from 'node:async_hooks';
import { UICoverageTracker } from './core';

const storage = new AsyncLocalStorage<UICoverageTracker>();

export const coverageContext = {
  run<T>(tracker: UICoverageTracker, fn: () => T): T {
    return storage.run(tracker, fn);
  },
  get(): UICoverageTracker | undefined {
    return storage.getStore();
  }
};