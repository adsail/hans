import type { Page } from 'playwright';
import { SELECTORS, URLS } from './selectors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('wegmans-auth');

export interface AuthCredentials {
  email: string;
  password: string;
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.goto(URLS.shoppingList, { waitUntil: 'networkidle', timeout: 30000 });

    // Check if we're redirected to login page
    const currentUrl = page.url();
    if (currentUrl.includes('sign-in') || currentUrl.includes('login')) {
      logger.debug('Not logged in: redirected to login page');
      return false;
    }

    // Check for account menu or other logged-in indicators
    const accountMenu = await page.$(SELECTORS.nav.accountMenu);
    if (accountMenu) {
      logger.debug('Logged in: account menu found');
      return true;
    }

    // Check for shopping list content
    const listContainer = await page.$(SELECTORS.list.container);
    if (listContainer) {
      logger.debug('Logged in: shopping list container found');
      return true;
    }

    logger.debug('Login status unclear, assuming not logged in');
    return false;
  } catch (error) {
    logger.error('Error checking login status', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

export async function login(page: Page, credentials: AuthCredentials): Promise<boolean> {
  try {
    logger.info('Attempting to log in to Wegmans');

    await page.goto(URLS.login, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for login form
    await page.waitForSelector(SELECTORS.login.emailInput, { timeout: 10000 });

    // Fill in credentials
    await page.fill(SELECTORS.login.emailInput, credentials.email);
    await page.fill(SELECTORS.login.passwordInput, credentials.password);

    // Submit form
    await page.click(SELECTORS.login.submitButton);

    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });

    // Verify login succeeded
    const currentUrl = page.url();
    if (currentUrl.includes('sign-in') || currentUrl.includes('login')) {
      // Check for error message
      const errorEl = await page.$(SELECTORS.common.errorMessage);
      if (errorEl) {
        const errorText = await errorEl.textContent();
        logger.error('Login failed', { error: errorText });
        return false;
      }
      logger.error('Login failed: still on login page');
      return false;
    }

    logger.info('Login successful');
    return true;
  } catch (error) {
    logger.error('Login error', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

export async function ensureAuthenticated(
  page: Page,
  credentials: AuthCredentials
): Promise<boolean> {
  const loggedIn = await isLoggedIn(page);
  if (loggedIn) {
    return true;
  }

  logger.info('Not logged in, attempting authentication');
  return await login(page, credentials);
}
