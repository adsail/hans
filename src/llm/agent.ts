import { GeminiService, type FunctionCall, type LLMResponse } from './gemini.js';
import { WegmansAction } from '../actions/wegmans/index.js';
import type { BrowserPool } from '../browser/pool.js';
import type { DB } from '../db/sqlite.js';
import type { Config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('agent');

export interface AgentContext {
  browserPool: BrowserPool;
  db: DB;
  config: Config;
}

export class HansAgent {
  private gemini: GeminiService;
  private wegmans: WegmansAction;
  private context: AgentContext;

  constructor(geminiApiKey: string, context: AgentContext) {
    this.gemini = new GeminiService({ apiKey: geminiApiKey });
    this.wegmans = new WegmansAction();
    this.context = context;
  }

  async handleMessage(userId: string, message: string): Promise<string> {
    logger.info('Agent handling message', { userId, message });

    try {
      // Send message to Gemini
      let response = await this.gemini.chat(userId, message);

      // Process function calls in a loop (agent can chain multiple calls)
      let iterations = 0;
      const maxIterations = 5; // Prevent infinite loops

      while (response.functionCalls && response.functionCalls.length > 0 && iterations < maxIterations) {
        iterations++;
        logger.info('Processing function calls', {
          count: response.functionCalls.length,
          iteration: iterations,
        });

        // Execute all function calls
        for (const call of response.functionCalls) {
          const result = await this.executeFunction(call, userId);
          this.gemini.addFunctionResult(userId, call.name, result);
        }

        // Continue conversation with function results
        response = await this.gemini.continueWithFunctionResults(userId);
      }

      // Return the final text response
      if (response.text) {
        return response.text;
      }

      // Fallback if no text response
      return "Done!";
    } catch (error) {
      logger.error('Agent error', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Provide helpful error message
      if (error instanceof Error && error.message.includes('API key')) {
        return "I'm having trouble connecting to my brain. Please check the Gemini API key.";
      }

      return "Sorry, something went wrong. Please try again.";
    }
  }

  private async executeFunction(call: FunctionCall, userId: string): Promise<string> {
    logger.info('Executing function', { name: call.name, args: call.args });

    const actionContext = {
      browserPool: this.context.browserPool,
      db: this.context.db,
      config: this.context.config,
      message: '',
      match: [''] as unknown as RegExpMatchArray,
    };

    try {
      switch (call.name) {
        case 'add_to_grocery_list': {
          const items = call.args.items as string[];
          const results: string[] = [];

          for (const item of items) {
            // Use the wegmans action's add logic
            actionContext.message = `add ${item}`;
            actionContext.match = actionContext.message.match(/^add\s+(.+)$/i) as RegExpMatchArray;

            const result = await this.wegmans.execute(actionContext);
            results.push(`${item}: ${result.message}`);
          }

          return results.join('\n');
        }

        case 'search_grocery_item': {
          const query = call.args.query as string;
          actionContext.message = `search ${query}`;
          actionContext.match = actionContext.message.match(/^search\s+(.+)$/i) as RegExpMatchArray;

          const result = await this.wegmans.execute(actionContext);
          return result.message;
        }

        case 'remove_from_grocery_list': {
          const item = call.args.item as string;
          actionContext.message = `remove ${item}`;
          actionContext.match = actionContext.message.match(/^remove\s+(.+)$/i) as RegExpMatchArray;

          const result = await this.wegmans.execute(actionContext);
          return result.message;
        }

        case 'show_grocery_list': {
          actionContext.message = 'list';
          actionContext.match = actionContext.message.match(/^list$/i) as RegExpMatchArray;

          const result = await this.wegmans.execute(actionContext);
          return result.message;
        }

        case 'clear_grocery_list': {
          actionContext.message = 'clear list';
          actionContext.match = actionContext.message.match(/^clear\s+list$/i) as RegExpMatchArray;

          const result = await this.wegmans.execute(actionContext);
          return result.message;
        }

        case 'select_item': {
          const selection = call.args.selection as number;
          actionContext.message = `pick ${selection}`;
          actionContext.match = actionContext.message.match(/^pick\s+(\d+)$/i) as RegExpMatchArray;

          const result = await this.wegmans.execute(actionContext);
          return result.message;
        }

        default:
          logger.warn('Unknown function', { name: call.name });
          return `Unknown function: ${call.name}`;
      }
    } catch (error) {
      logger.error('Function execution error', {
        name: call.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return `Error executing ${call.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  clearContext(userId: string): void {
    this.gemini.clearHistory(userId);
  }
}
