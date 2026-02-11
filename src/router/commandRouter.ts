import { registry, ActionRegistry } from '../actions/registry.js';
import { parseCommand } from './commandParser.js';
import type { ActionResult } from '../actions/base.js';
import type { DB } from '../db/sqlite.js';
import type { BrowserPool } from '../browser/pool.js';
import type { Config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('command-router');

export interface RouterContext {
  db: DB;
  browserPool: BrowserPool;
  config: Config;
}

export class CommandRouter {
  private registry: ActionRegistry;
  private context: RouterContext;

  constructor(context: RouterContext) {
    this.registry = registry;
    this.context = context;
  }

  async route(message: string): Promise<ActionResult> {
    const parsed = parseCommand(message);

    logger.info('Routing message', {
      raw: parsed.raw,
      isCommand: parsed.isCommand
    });

    // Handle help command directly
    if (/^help$/i.test(parsed.normalized)) {
      return {
        success: true,
        message: this.registry.getHelpMessage(),
      };
    }

    // For non-commands, provide a friendly response
    if (!parsed.isCommand) {
      return {
        success: true,
        message: 'Hi! Send "help" to see what I can do.',
      };
    }

    // Try to execute through the registry
    const result = await this.registry.execute(parsed.raw, {
      db: this.context.db,
      browserPool: this.context.browserPool,
      config: this.context.config,
    });

    // Log the message and response
    this.context.db.logMessage(
      'user',
      message,
      result.message
    );

    return result;
  }
}
