import type { Page, BrowserContext } from 'playwright';
import type { BrowserPool } from '../../browser/pool.js';
import { ensureAuthenticated, type AuthCredentials } from './auth.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('wegmans-browser');

const CONTEXT_NAME = 'wegmans';

export class WegmansBrowser {
  private browserPool: BrowserPool;
  private credentials: AuthCredentials;
  private page: Page | null = null;

  constructor(browserPool: BrowserPool, credentials: AuthCredentials) {
    this.browserPool = browserPool;
    this.credentials = credentials;
  }

  async getPage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    logger.info('Getting Wegmans browser page');

    const context = await this.browserPool.getContext(CONTEXT_NAME);
    this.page = await context.newPage();

    // Ensure we're authenticated
    const authenticated = await ensureAuthenticated(this.page, this.credentials);
    if (!authenticated) {
      throw new Error('Failed to authenticate with Wegmans');
    }

    // Save the authenticated state
    await this.browserPool.saveContextState(CONTEXT_NAME);

    return this.page;
  }

  async closePage(): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
      this.page = null;
    }
  }

  async withPage<T>(operation: (page: Page) => Promise<T>): Promise<T> {
    const page = await this.getPage();
    try {
      const result = await operation(page);
      // Save state after successful operation
      await this.browserPool.saveContextState(CONTEXT_NAME);
      return result;
    } catch (error) {
      logger.error('Page operation failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      // Try to recover by getting a fresh page
      await this.closePage();
      throw error;
    }
  }
}
