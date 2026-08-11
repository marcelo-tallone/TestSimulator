import { startAdminServer } from './admin/admin-server.js';
import { loadSimulations, getAllSimulations } from './store/simulation-store.js';
import { initTemplateWatcher } from './templates/template-loader.js';
import { stopSimulation } from './simulators/manager.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('Starting TestSimulator...');

  initTemplateWatcher();
  loadSimulations();

  const server = await startAdminServer();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down...`);
    for (const sim of getAllSimulations()) {
      if (sim.status === 'running') {
        await stopSimulation(sim);
      }
    }
    server.close(() => {
      logger.info('TestSimulator stopped');
      process.exit(0);
    });
    // Drop lingering keep-alive connections (e.g. the dashboard webview) so
    // close() resolves immediately instead of waiting for them.
    server.closeAllConnections?.();
    // Backstop force-exit in case anything still holds the loop open.
    setTimeout(() => process.exit(0), 800).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Watchdog: when launched by the desktop app, exit if the parent process
  // dies (we get reparented to launchd / PID 1) so no orphan server lingers.
  const initialPpid = process.ppid;
  setInterval(() => {
    if (process.ppid !== initialPpid || process.ppid === 1) {
      logger.info('Parent process exited, shutting down');
      process.exit(0);
    }
  }, 2000).unref();
}

main().catch(err => {
  logger.error(`Fatal error: ${String(err)}`);
  process.exit(1);
});
