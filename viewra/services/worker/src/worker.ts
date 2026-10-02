import type { Logger } from "pino";
import type { WorkerConfig } from "./config.js";
import { claimAndProcess, type ProcessJobDeps } from "./process-job.js";
import type { StorageService } from "./storage.js";

export type WorkerLoopOptions = {
  config: WorkerConfig;
  storage: StorageService;
  logger: Logger;
  /** Optional abort signal for graceful shutdown / tests. */
  signal?: AbortSignal;
};

/**
 * Poll Mongo for jobs and process up to `workerConcurrency` in parallel.
 */
export async function runWorkerLoop(options: WorkerLoopOptions): Promise<void> {
  const { config, storage, logger, signal } = options;
  const deps: ProcessJobDeps = { config, storage, logger };

  logger.info(
    {
      pollIntervalMs: config.workerPollIntervalMs,
      concurrency: config.workerConcurrency,
      maxRetries: config.workerMaxRetries,
    },
    "Worker loop started",
  );

  while (!signal?.aborted) {
    const slots = config.workerConcurrency;
    const results = await Promise.all(
      Array.from({ length: slots }, () => claimAndProcess(deps)),
    );
    const didWork = results.some(Boolean);

    if (!didWork) {
      await sleep(config.workerPollIntervalMs, signal);
    }
  }

  logger.info("Worker loop stopped");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
