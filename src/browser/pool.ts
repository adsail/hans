import { chromium, Browser, BrowserContext } from 'playwright';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('browser-pool');

export interface BrowserPoolConfig {
  statePath: string;
  headless?: boolean;
}

export class BrowserPool {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private config: BrowserPoolConfig;
  private initPromise: Promise<Browser> | null = null;

  constructor(config: BrowserPoolConfig) {
    this.config = {
      headless: true,
      ...config,
    };
  }

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initBrowser();
    try {
      this.browser = await this.initPromise;
      return this.browser;
    } finally {
      this.initPromise = null;
    }
  }

  private async initBrowser(): Promise<Browser> {
    logger.info('Launching browser', { headless: this.config.headless });

    const browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process',
      ],
    });

    browser.on('disconnected', () => {
      logger.warn('Browser disconnected');
      this.browser = null;
      this.contexts.clear();
    });

    logger.info('Browser launched successfully');
    return browser;
  }

  async getContext(name: string): Promise<BrowserContext> {
    const existing = this.contexts.get(name);
    if (existing) {
      return existing;
    }

    const browser = await this.getBrowser();
    const storagePath = `${this.config.statePath}/${name}`;

    logger.info('Creating browser context', { name, storagePath });

    let context: BrowserContext;
    try {
      // Try to load existing state
      context = await browser.newContext({
        storageState: storagePath,
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      logger.info('Loaded existing browser state', { name });
    } catch {
      // No existing state, create fresh context
      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });
      logger.info('Created fresh browser context', { name });
    }

    this.contexts.set(name, context);
    return context;
  }

  async saveContextState(name: string): Promise<void> {
    const context = this.contexts.get(name);
    if (!context) {
      logger.warn('Cannot save state: context not found', { name });
      return;
    }

    const storagePath = `${this.config.statePath}/${name}`;
    await context.storageState({ path: storagePath });
    logger.info('Saved browser state', { name, path: storagePath });
  }

  async closeContext(name: string): Promise<void> {
    const context = this.contexts.get(name);
    if (context) {
      await this.saveContextState(name);
      await context.close();
      this.contexts.delete(name);
      logger.info('Closed browser context', { name });
    }
  }

  async close(): Promise<void> {
    logger.info('Closing browser pool');

    // Save all context states before closing
    for (const name of this.contexts.keys()) {
      await this.saveContextState(name);
    }

    for (const context of this.contexts.values()) {
      await context.close();
    }
    this.contexts.clear();

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    logger.info('Browser pool closed');
  }
}
