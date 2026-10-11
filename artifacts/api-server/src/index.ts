import app from "./app";
import { logger } from "./lib/logger";
import { startOrderEmailWorker } from "./lib/orderEmails";
import { applyCatalogAdditions } from "./lib/catalogAdditions";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  // Publish owns schema creation. This only inserts explicitly bundled catalog
  // data into the application's configured database, once per addition.
  const additions = await applyCatalogAdditions();
  logger.info({ additions }, "Published catalog additions checked");

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startOrderEmailWorker();
  });
}

startServer().catch(err => {
  logger.error({ err }, "Could not initialize the server");
  process.exit(1);
});
