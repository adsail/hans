import type { Page } from 'playwright';
import { SELECTORS, URLS } from './selectors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('wegmans-list');

export interface ListItem {
  name: string;
  price?: string;
  size?: string;
}

export interface SearchResult {
  name: string;
  price?: string;
  size?: string;
  index: number;
}

export async function navigateToList(page: Page): Promise<boolean> {
  try {
    const currentUrl = page.url();
    if (currentUrl.includes('shopping-list')) {
      logger.debug('Already on shopping list page');
      return true;
    }

    logger.info('Navigating to shopping list');
    await page.goto(URLS.shoppingList, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for list to load
    await page.waitForSelector(
      `${SELECTORS.list.container}, ${SELECTORS.list.emptyMessage}`,
      { timeout: 10000 }
    );

    return true;
  } catch (error) {
    logger.error('Failed to navigate to shopping list', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

export async function getListItems(page: Page): Promise<ListItem[]> {
  try {
    await navigateToList(page);

    const items = await page.$$eval(SELECTORS.list.item, (elements) => {
      return elements.map(el => {
        const nameEl = el.querySelector('.item-name, .product-name, span');
        const priceEl = el.querySelector('.price, .product-price');
        const sizeEl = el.querySelector('.size, .product-size');
        return {
          name: nameEl?.textContent?.trim() || 'Unknown item',
          price: priceEl?.textContent?.trim(),
          size: sizeEl?.textContent?.trim(),
        };
      });
    });

    logger.info('Retrieved list items', { count: items.length });
    return items;
  } catch (error) {
    logger.error('Failed to get list items', {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

// Search in "My Items" (past purchases) first
export async function searchMyItems(page: Page, query: string): Promise<SearchResult[]> {
  try {
    logger.info('Searching My Items', { query });

    await page.goto(URLS.myItems, { waitUntil: 'networkidle', timeout: 30000 });

    // Look for search input within My Items
    const searchInput = await page.$(SELECTORS.myItems.searchInput);
    if (searchInput) {
      await searchInput.fill(query);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Get matching items
    const items = await page.$$eval(SELECTORS.myItems.item, (elements, q) => {
      return elements
        .map((el, idx) => {
          const nameEl = el.querySelector('.item-name, .product-name, [data-testid="product-name"]');
          const name = nameEl?.textContent?.trim() || '';
          return { name, index: idx };
        })
        .filter(item => item.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 5);
    }, query);

    logger.info('My Items search results', { count: items.length });
    return items;
  } catch (error) {
    logger.error('Failed to search My Items', {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

// Search the full Wegmans catalog
export async function searchProducts(page: Page, query: string): Promise<SearchResult[]> {
  try {
    logger.info('Searching products', { query });

    await page.goto(URLS.search(query), { waitUntil: 'networkidle', timeout: 30000 });

    // Check for no results
    const noResults = await page.$(SELECTORS.search.noResults);
    if (noResults) {
      logger.info('No search results found');
      return [];
    }

    // Wait for results
    await page.waitForSelector(SELECTORS.search.productCard, { timeout: 10000 });

    // Get top 5 results
    const items = await page.$$eval(SELECTORS.search.productCard, (elements) => {
      return elements.slice(0, 5).map((el, idx) => {
        const nameEl = el.querySelector('.product-name, .product-title, h3, [data-testid="product-name"]');
        const priceEl = el.querySelector('.product-price, .price, [data-testid="product-price"]');
        const sizeEl = el.querySelector('.product-size, .size, [data-testid="product-size"]');
        return {
          name: nameEl?.textContent?.trim() || 'Unknown product',
          price: priceEl?.textContent?.trim(),
          size: sizeEl?.textContent?.trim(),
          index: idx,
        };
      });
    });

    logger.info('Search results', { count: items.length });
    return items;
  } catch (error) {
    logger.error('Failed to search products', {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

// Add item by clicking the nth search result
export async function addSearchResultToList(page: Page, query: string, resultIndex: number): Promise<boolean> {
  try {
    logger.info('Adding search result to list', { query, index: resultIndex });

    // Re-search to ensure we're on the right page
    await page.goto(URLS.search(query), { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector(SELECTORS.search.productCard, { timeout: 10000 });

    const productCards = await page.$$(SELECTORS.search.productCard);
    if (resultIndex >= productCards.length) {
      logger.warn('Result index out of range', { index: resultIndex, available: productCards.length });
      return false;
    }

    const targetCard = productCards[resultIndex];

    // Try to find add to list button directly on the card
    let addButton = await targetCard.$(SELECTORS.search.addToListButton);

    if (addButton) {
      await addButton.click();
    } else {
      // Click the product to open details, then find add button
      await targetCard.click();
      await page.waitForTimeout(1500);

      addButton = await page.$(SELECTORS.search.addToListButton);
      if (addButton) {
        await addButton.click();
      } else {
        logger.warn('Could not find Add to List button');
        return false;
      }
    }

    await page.waitForTimeout(2000);
    logger.info('Item added to list');
    return true;
  } catch (error) {
    logger.error('Failed to add search result to list', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

// Add from My Items by index
export async function addMyItemToList(page: Page, query: string, resultIndex: number): Promise<boolean> {
  try {
    logger.info('Adding My Item to list', { query, index: resultIndex });

    await page.goto(URLS.myItems, { waitUntil: 'networkidle', timeout: 30000 });

    // Search within My Items
    const searchInput = await page.$(SELECTORS.myItems.searchInput);
    if (searchInput) {
      await searchInput.fill(query);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    const items = await page.$$(SELECTORS.myItems.item);
    if (resultIndex >= items.length) {
      logger.warn('My Item index out of range');
      return false;
    }

    const targetItem = items[resultIndex];
    const addButton = await targetItem.$(SELECTORS.myItems.addToListButton);

    if (addButton) {
      await addButton.click();
      await page.waitForTimeout(1500);
      logger.info('My Item added to list');
      return true;
    }

    logger.warn('Could not find Add to List button for My Item');
    return false;
  } catch (error) {
    logger.error('Failed to add My Item to list', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

export async function removeItemFromList(page: Page, itemName: string): Promise<boolean> {
  try {
    logger.info('Removing item from list', { item: itemName });

    await navigateToList(page);

    // Find the item by name
    const items = await page.$$(SELECTORS.list.item);

    for (const item of items) {
      const nameEl = await item.$(SELECTORS.list.itemName);
      if (!nameEl) continue;

      const name = await nameEl.textContent();
      if (name?.toLowerCase().includes(itemName.toLowerCase())) {
        // Found the item, click remove
        const removeBtn = await item.$(SELECTORS.list.removeButton);
        if (removeBtn) {
          await removeBtn.click();
          await page.waitForTimeout(1000);
          logger.info('Item removed successfully', { item: itemName });
          return true;
        }
      }
    }

    logger.warn('Item not found in list', { item: itemName });
    return false;
  } catch (error) {
    logger.error('Failed to remove item from list', {
      item: itemName,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

export async function clearList(page: Page): Promise<boolean> {
  try {
    logger.info('Clearing shopping list');

    await navigateToList(page);

    // Look for clear all button
    const clearButton = await page.$(SELECTORS.list.clearAllButton);
    if (clearButton) {
      await clearButton.click();

      // Handle confirmation dialog if present
      const confirmButton = await page.$('button:has-text("Confirm"), button:has-text("Yes")');
      if (confirmButton) {
        await confirmButton.click();
      }

      await page.waitForTimeout(2000);
      logger.info('List cleared successfully');
      return true;
    }

    // If no clear all button, remove items one by one
    const removeButtons = await page.$$(SELECTORS.list.removeButton);
    for (const btn of removeButtons) {
      await btn.click();
      await page.waitForTimeout(500);
    }

    logger.info('List cleared by removing all items');
    return true;
  } catch (error) {
    logger.error('Failed to clear list', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}
