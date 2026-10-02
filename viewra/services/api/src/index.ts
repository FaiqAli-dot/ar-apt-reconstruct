import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { connectDb } from "./db.js";

async function main() {
  const config = loadConfig();
  await connectDb(config.databaseUrl);
  const app = await buildApp({ config });

  try {
    await app.storage.ensureBucket();
  } catch (err) {
    app.log.warn({ err }, "Could not ensure S3 bucket on startup");
  }

  await app.listen({ host: config.apiHost, port: config.apiPort });
  app.log.info(`Viewra API listening on ${config.apiHost}:${config.apiPort}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
