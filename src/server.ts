import { App } from './app';
import { config } from './config/env';

const application = new App();

const server = application.instance.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[server] portfolio listening on http://localhost:${config.port}  (env: ${config.nodeEnv})`,
  );
});

/** Close the HTTP server and the database cleanly on a termination signal. */
function shutdown(signal: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n[server] ${signal} received — shutting down gracefully.`);
  server.close(() => {
    application.database.close();
    process.exit(0);
  });
  // Hard-exit if connections don't drain promptly.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
