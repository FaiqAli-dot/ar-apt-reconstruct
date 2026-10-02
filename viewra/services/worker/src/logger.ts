import pino from "pino";
import type { WorkerConfig } from "./config.js";

export function createLogger(config: WorkerConfig) {
  return pino({
    level: config.logLevel,
    base: { service: "viewra-worker" },
  });
}
