import type { Action, ActionContext, ActionResult } from '../base.js';
import { WegmansBrowser } from './browser.js';
import {
  getListItems,
  removeItemFromList,
  clearList,
  searchMyItems,
  searchProducts,
  addMyItemToList,
  addSearchResultToList,
  type SearchResult,
} from './list.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('wegmans-action');

// Store pending selections per user session
interface PendingSelection {
  query: string;
  results: SearchResult[];
  source: 'myItems' | 'search';
  timestamp: number;
}

const pendingSelections: Map<string, PendingSelection> = new Map();
const SELECTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export class WegmansAction implements Action {
  name = 'wegmans';
  description = 'Manage your Wegmans shopping list:\n  • add <item> - Add from past purchases or search\n  • search <item> - Search full catalog (skip past purchases)\n  • remove <item> - Remove from list\n  • list - Show current list\n  • clear list - Clear all items\n  • pick <number> - Select from options';

  patterns = [
    /^add\s+(.+)$/i,
    /^search\s+(.+)$/i,
    /^remove\s+(.+)$/i,
    /^(?:list|show\s+list|shopping\s+list)$/i,
    /^clear\s+list$/i,
    /^(?:pick|select|choose)\s+(\d+)$/i,
  ];

  private browserInstance: WegmansBrowser | null = null;

  private getBrowser(context: ActionContext): WegmansBrowser {
    if (!this.browserInstance) {
      this.browserInstance = new WegmansBrowser(context.browserPool, {
        email: context.config.wegmans.email,
        password: context.config.wegmans.password,
      });
    }
    return this.browserInstance;
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const { message, match, db } = context;
    const browser = this.getBrowser(context);

    // Clean up old pending selections
    this.cleanupPendingSelections();

    // Handle selection response
    if (/^(?:pick|select|choose)\s+\d+$/i.test(message)) {
      const selection = parseInt(match[1], 10);
      return this.handleSelection(browser, selection, db);
    }

    // Handle add command
    if (/^add\s+/i.test(message)) {
      return this.handleAdd(browser, match[1], db);
    }

    // Handle search command (skip My Items)
    if (/^search\s+/i.test(message)) {
      return this.handleSearch(browser, match[1], db);
    }

    // Handle remove command
    if (/^remove\s+/i.test(message)) {
      return this.handleRemove(browser, match[1], db);
    }

    // Handle list command
    if (/^(?:list|show\s+list|shopping\s+list)$/i.test(message)) {
      return this.handleList(browser, db);
    }

    // Handle clear command
    if (/^clear\s+list$/i.test(message)) {
      return this.handleClear(browser, db);
    }

    return {
      success: false,
      message: 'Unknown Wegmans command',
    };
  }

  private cleanupPendingSelections(): void {
    const now = Date.now();
    for (const [key, selection] of pendingSelections.entries()) {
      if (now - selection.timestamp > SELECTION_TIMEOUT) {
        pendingSelections.delete(key);
      }
    }
  }

  private async handleAdd(
    browser: WegmansBrowser,
    item: string,
    db: ActionContext['db']
  ): Promise<ActionResult> {
    logger.info('Handling add command', { item });

    try {
      // First, check "My Items" for exact or close matches
      const myItemsResults = await browser.withPage(async (page) => {
        return await searchMyItems(page, item);
      });

      if (myItemsResults.length > 0) {
        // Check for exact match (case-insensitive)
        const exactMatch = myItemsResults.find(
          r => r.name.toLowerCase() === item.toLowerCase()
        );

        if (exactMatch) {
          // Exact match found in My Items - add directly
          const success = await browser.withPage(async (page) => {
            return await addMyItemToList(page, item, exactMatch.index);
          });

          if (success) {
            db.addGroceryItem(exactMatch.name);
            return {
              success: true,
              message: `Added "${exactMatch.name}" from your past purchases`,
            };
          }
        }

        // Multiple options in My Items - let user choose
        pendingSelections.set('default', {
          query: item,
          results: myItemsResults,
          source: 'myItems',
          timestamp: Date.now(),
        });

        const options = myItemsResults
          .map((r, i) => `${i + 1}. ${r.name}${r.price ? ` - ${r.price}` : ''}`)
          .join('\n');

        return {
          success: true,
          message: `Found in your past purchases:\n\n${options}\n\nReply "pick <number>" to select, or I'll search the full catalog if none match.`,
        };
      }

      // No My Items results, search full catalog
      const searchResults = await browser.withPage(async (page) => {
        return await searchProducts(page, item);
      });

      if (searchResults.length === 0) {
        return {
          success: false,
          message: `Couldn't find "${item}" on Wegmans. Try a different search term.`,
        };
      }

      // Check for single result or exact match
      if (searchResults.length === 1) {
        const success = await browser.withPage(async (page) => {
          return await addSearchResultToList(page, item, 0);
        });

        if (success) {
          db.addGroceryItem(searchResults[0].name);
          return {
            success: true,
            message: `Added "${searchResults[0].name}" to your list`,
          };
        }
      }

      // Multiple results - let user choose
      pendingSelections.set('default', {
        query: item,
        results: searchResults,
        source: 'search',
        timestamp: Date.now(),
      });

      const options = searchResults
        .map((r, i) => {
          let line = `${i + 1}. ${r.name}`;
          if (r.size) line += ` (${r.size})`;
          if (r.price) line += ` - ${r.price}`;
          return line;
        })
        .join('\n');

      return {
        success: true,
        message: `Found ${searchResults.length} items for "${item}":\n\n${options}\n\nReply "pick <number>" to add one.`,
      };
    } catch (error) {
      logger.error('Add operation failed', { error });
      return {
        success: false,
        message: `Failed to search for "${item}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Search full catalog directly, skipping My Items
  private async handleSearch(
    browser: WegmansBrowser,
    item: string,
    db: ActionContext['db']
  ): Promise<ActionResult> {
    logger.info('Handling search command (full catalog)', { item });

    try {
      const searchResults = await browser.withPage(async (page) => {
        return await searchProducts(page, item);
      });

      if (searchResults.length === 0) {
        return {
          success: false,
          message: `Couldn't find "${item}" on Wegmans. Try a different search term.`,
        };
      }

      // Check for single result
      if (searchResults.length === 1) {
        const success = await browser.withPage(async (page) => {
          return await addSearchResultToList(page, item, 0);
        });

        if (success) {
          db.addGroceryItem(searchResults[0].name);
          return {
            success: true,
            message: `Added "${searchResults[0].name}" to your list`,
          };
        }
      }

      // Multiple results - let user choose
      pendingSelections.set('default', {
        query: item,
        results: searchResults,
        source: 'search',
        timestamp: Date.now(),
      });

      const options = searchResults
        .map((r, i) => {
          let line = `${i + 1}. ${r.name}`;
          if (r.size) line += ` (${r.size})`;
          if (r.price) line += ` - ${r.price}`;
          return line;
        })
        .join('\n');

      return {
        success: true,
        message: `Found ${searchResults.length} items for "${item}":\n\n${options}\n\nReply "pick <number>" to add one.`,
      };
    } catch (error) {
      logger.error('Search operation failed', { error });
      return {
        success: false,
        message: `Failed to search for "${item}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async handleSelection(
    browser: WegmansBrowser,
    selection: number,
    db: ActionContext['db']
  ): Promise<ActionResult> {
    const pending = pendingSelections.get('default');

    if (!pending) {
      return {
        success: false,
        message: 'No pending selection. Use "add <item>" to search first.',
      };
    }

    const index = selection - 1; // Convert to 0-based index

    if (index < 0 || index >= pending.results.length) {
      return {
        success: false,
        message: `Please pick a number between 1 and ${pending.results.length}`,
      };
    }

    const selectedItem = pending.results[index];
    logger.info('Processing selection', { selection, item: selectedItem.name });

    try {
      let success: boolean;

      if (pending.source === 'myItems') {
        success = await browser.withPage(async (page) => {
          return await addMyItemToList(page, pending.query, selectedItem.index);
        });
      } else {
        success = await browser.withPage(async (page) => {
          return await addSearchResultToList(page, pending.query, selectedItem.index);
        });
      }

      // Clear the pending selection
      pendingSelections.delete('default');

      if (success) {
        db.addGroceryItem(selectedItem.name);
        return {
          success: true,
          message: `Added "${selectedItem.name}" to your list`,
        };
      }

      return {
        success: false,
        message: `Couldn't add "${selectedItem.name}". Please try again.`,
      };
    } catch (error) {
      logger.error('Selection failed', { error });
      pendingSelections.delete('default');
      return {
        success: false,
        message: `Failed to add item: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async handleRemove(
    browser: WegmansBrowser,
    item: string,
    db: ActionContext['db']
  ): Promise<ActionResult> {
    logger.info('Handling remove command', { item });

    try {
      const success = await browser.withPage(async (page) => {
        return await removeItemFromList(page, item);
      });

      if (success) {
        db.removeGroceryItem(item);
        return {
          success: true,
          message: `Removed "${item}" from your list`,
        };
      }

      return {
        success: false,
        message: `Couldn't find "${item}" in your list`,
      };
    } catch (error) {
      logger.error('Remove operation failed', { error });
      return {
        success: false,
        message: `Failed to remove "${item}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async handleList(
    browser: WegmansBrowser,
    db: ActionContext['db']
  ): Promise<ActionResult> {
    logger.info('Handling list command');

    try {
      const items = await browser.withPage(async (page) => {
        return await getListItems(page);
      });

      if (items.length === 0) {
        return {
          success: true,
          message: 'Your shopping list is empty',
        };
      }

      const itemList = items.map((item, i) => {
        let line = `${i + 1}. ${item.name}`;
        if (item.size) line += ` (${item.size})`;
        if (item.price) line += ` - ${item.price}`;
        return line;
      }).join('\n');

      return {
        success: true,
        message: `Your shopping list (${items.length} items):\n\n${itemList}`,
        data: items,
      };
    } catch (error) {
      logger.error('List operation failed', { error });

      // Fall back to local cache
      const cachedItems = db.getGroceryItems();
      if (cachedItems.length > 0) {
        const itemList = cachedItems.map((item, i) => `${i + 1}. ${item.name}`).join('\n');
        return {
          success: true,
          message: `(Cached) Your shopping list (${cachedItems.length} items):\n\n${itemList}`,
          data: cachedItems,
        };
      }

      return {
        success: false,
        message: `Failed to get list: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async handleClear(
    browser: WegmansBrowser,
    db: ActionContext['db']
  ): Promise<ActionResult> {
    logger.info('Handling clear command');

    try {
      const success = await browser.withPage(async (page) => {
        return await clearList(page);
      });

      if (success) {
        const count = db.clearGroceryItems();
        return {
          success: true,
          message: `Cleared your shopping list (${count} items removed)`,
        };
      }

      return {
        success: false,
        message: 'Failed to clear the list',
      };
    } catch (error) {
      logger.error('Clear operation failed', { error });
      return {
        success: false,
        message: `Failed to clear list: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
