import { loadConfig } from './config.js';
import { createLogger, logger } from './utils/logger.js';
import { createWhatsAppClient } from './whatsapp/client.js';
import { setupMessageHandler } from './whatsapp/messageHandler.js';
import { HansAgent } from './llm/agent.js';
import { BrowserPool } from './browser/pool.js';
import { DB } from './db/sqlite.js';

const log = createLogger('main');

async function main() {
  log.info('Starting Hans - Personal WhatsApp Assistant');

  // Load configuration
  let config;
  try {
    config = loadConfig();
    log.info('Configuration loaded');
  } catch (error) {
    log.error('Failed to load configuration', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }

  // Initialize database
  const db = new DB(config.dbPath);
  log.info('Database initialized');

  // Initialize browser pool
  const browserPool = new BrowserPool({
    statePath: config.browserStatePath,
    headless: true,
  });
  log.info('Browser pool initialized');

  // Initialize the Hans agent with Gemini
  const agent = new HansAgent(config.geminiApiKey, {
    browserPool,
    db,
    config,
  });
  log.info('Hans agent initialized with Gemini');

  // Create and initialize WhatsApp client
  const whatsappClient = createWhatsAppClient({
    sessionPath: config.whatsappSessionPath,
  });

  // Setup message handling with the agent
  setupMessageHandler(whatsappClient, agent, {
    ownerPhoneNumber: config.ownerPhoneNumber,
  });

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    log.info(`Received ${signal}, shutting down gracefully...`);

    try {
      await whatsappClient.destroy();
      log.info('WhatsApp client destroyed');
    } catch (error) {
      log.error('Error destroying WhatsApp client', { error });
    }

    try {
      await browserPool.close();
      log.info('Browser pool closed');
    } catch (error) {
      log.error('Error closing browser pool', { error });
    }

    try {
      db.close();
      log.info('Database closed');
    } catch (error) {
      log.error('Error closing database', { error });
    }

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Initialize WhatsApp client
  try {
    log.info('Initializing WhatsApp client...');
    await whatsappClient.initialize();
    log.info('WhatsApp client initialized successfully');
  } catch (error) {
    log.error('Failed to initialize WhatsApp client', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unhandled error in main', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
