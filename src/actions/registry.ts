import type { Action, ActionContext, ActionResult } from './base.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('registry');

export class ActionRegistry {
  private actions: Action[] = [];

  register(action: Action): void {
    logger.info('Registering action', { name: action.name });
    this.actions.push(action);
  }

  findAction(message: string): { action: Action; match: RegExpMatchArray } | null {
    for (const action of this.actions) {
      for (const pattern of action.patterns) {
        const match = message.match(pattern);
        if (match) {
          logger.debug('Found matching action', {
            action: action.name,
            pattern: pattern.source
          });
          return { action, match };
        }
      }
    }
    return null;
  }

  async execute(message: string, context: Omit<ActionContext, 'match' | 'message'>): Promise<ActionResult> {
    const result = this.findAction(message);

    if (!result) {
      return {
        success: false,
        message: this.getHelpMessage(),
      };
    }

    const { action, match } = result;
    const fullContext: ActionContext = {
      ...context,
      message,
      match,
    };

    try {
      logger.info('Executing action', { action: action.name, message });
      return await action.execute(fullContext);
    } catch (error) {
      logger.error('Action execution failed', {
        action: action.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        success: false,
        message: `Error executing ${action.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  getHelpMessage(): string {
    const lines = ['Available commands:', ''];
    for (const action of this.actions) {
      lines.push(`*${action.name}*: ${action.description}`);
    }
    return lines.join('\n');
  }

  getActions(): Action[] {
    return [...this.actions];
  }
}

export const registry = new ActionRegistry();
