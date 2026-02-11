import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockDB } from '../mocks/db.mock.js';
import { createMockPage } from '../mocks/browser.mock.js';

// Mock the list operations
const mockListOperations = {
  searchMyItems: vi.fn(),
  searchProducts: vi.fn(),
  addMyItemToList: vi.fn(),
  addSearchResultToList: vi.fn(),
  removeItemFromList: vi.fn(),
  getListItems: vi.fn(),
  clearList: vi.fn(),
  navigateToList: vi.fn(),
};

vi.mock('../../src/actions/wegmans/list.js', () => mockListOperations);

// Create a mock class for WegmansBrowser
const mockWithPage = vi.fn();

class MockWegmansBrowser {
  withPage = mockWithPage;
}

vi.mock('../../src/actions/wegmans/browser.js', () => ({
  WegmansBrowser: MockWegmansBrowser,
}));

describe('WegmansAction', () => {
  let action: InstanceType<typeof import('../../src/actions/wegmans/index.js').WegmansAction>;
  let mockDB: ReturnType<typeof createMockDB>;
  let actionContext: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDB = createMockDB();

    // Reset mock implementations
    mockListOperations.searchMyItems.mockResolvedValue([]);
    mockListOperations.searchProducts.mockResolvedValue([]);
    mockListOperations.addMyItemToList.mockResolvedValue(true);
    mockListOperations.addSearchResultToList.mockResolvedValue(true);
    mockListOperations.removeItemFromList.mockResolvedValue(true);
    mockListOperations.getListItems.mockResolvedValue([]);
    mockListOperations.clearList.mockResolvedValue(true);

    // Default mock for withPage - calls the function with a mock page
    mockWithPage.mockImplementation(async (fn: any) => {
      const mockPage = createMockPage();
      return fn(mockPage);
    });

    // Need to re-import to get fresh instance
    vi.resetModules();
    const { WegmansAction } = await import('../../src/actions/wegmans/index.js');
    action = new WegmansAction();

    actionContext = {
      browserPool: {},
      db: mockDB,
      config: {
        wegmans: { email: 'test@example.com', password: 'password' },
      },
      message: '',
      match: null as any,
    };
  });

  describe('Add Command', () => {
    it('should check My Items first when adding', async () => {
      actionContext.message = 'add milk';
      actionContext.match = 'add milk'.match(/^add\s+(.+)$/i);

      mockListOperations.searchMyItems.mockResolvedValue([
        { name: 'Wegmans 2% Milk', index: 0 },
        { name: 'Wegmans Whole Milk', index: 1 },
      ]);

      const result = await action.execute(actionContext);

      expect(mockListOperations.searchMyItems).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toContain('past purchases');
    });

    it('should add directly if exact match found in My Items', async () => {
      actionContext.message = 'add milk';
      actionContext.match = 'add milk'.match(/^add\s+(.+)$/i);

      mockListOperations.searchMyItems.mockResolvedValue([
        { name: 'milk', index: 0 }, // Exact match
      ]);
      mockListOperations.addMyItemToList.mockResolvedValue(true);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Added');
      expect(mockDB.addGroceryItem).toHaveBeenCalledWith('milk');
    });

    it('should search full catalog if no My Items match', async () => {
      actionContext.message = 'add exotic fruit';
      actionContext.match = 'add exotic fruit'.match(/^add\s+(.+)$/i);

      mockListOperations.searchMyItems.mockResolvedValue([]);
      mockListOperations.searchProducts.mockResolvedValue([
        { name: 'Dragon Fruit', price: '$5.99', index: 0 },
        { name: 'Passion Fruit', price: '$3.99', index: 1 },
      ]);

      const result = await action.execute(actionContext);

      expect(mockListOperations.searchProducts).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Found');
    });

    it('should return error if no results found anywhere', async () => {
      actionContext.message = 'add xyznonexistent';
      actionContext.match = 'add xyznonexistent'.match(/^add\s+(.+)$/i);

      mockListOperations.searchMyItems.mockResolvedValue([]);
      mockListOperations.searchProducts.mockResolvedValue([]);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Couldn't find");
    });
  });

  describe('Search Command', () => {
    it('should skip My Items and search catalog directly', async () => {
      actionContext.message = 'search oat milk';
      actionContext.match = 'search oat milk'.match(/^search\s+(.+)$/i);

      mockListOperations.searchProducts.mockResolvedValue([
        { name: 'Oatly Oat Milk', price: '$5.49', index: 0 },
      ]);

      const result = await action.execute(actionContext);

      expect(mockListOperations.searchMyItems).not.toHaveBeenCalled();
      expect(mockListOperations.searchProducts).toHaveBeenCalled();
    });

    it('should add directly if only one search result', async () => {
      actionContext.message = 'search specific product xyz';
      actionContext.match = 'search specific product xyz'.match(/^search\s+(.+)$/i);

      mockListOperations.searchProducts.mockResolvedValue([
        { name: 'Specific Product XYZ', price: '$9.99', index: 0 },
      ]);
      mockListOperations.addSearchResultToList.mockResolvedValue(true);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Added');
    });
  });

  describe('Pick Command', () => {
    it('should select from pending options', async () => {
      // First, trigger a search that creates pending selection
      actionContext.message = 'add milk';
      actionContext.match = 'add milk'.match(/^add\s+(.+)$/i);

      mockListOperations.searchMyItems.mockResolvedValue([
        { name: 'Wegmans 2% Milk', index: 0 },
        { name: 'Wegmans Whole Milk', index: 1 },
      ]);

      await action.execute(actionContext);

      // Now pick option 2
      actionContext.message = 'pick 2';
      actionContext.match = 'pick 2'.match(/^(?:pick|select|choose)\s+(\d+)$/i);

      mockListOperations.addMyItemToList.mockResolvedValue(true);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Added');
    });

    it('should error if no pending selection', async () => {
      actionContext.message = 'pick 1';
      actionContext.match = 'pick 1'.match(/^(?:pick|select|choose)\s+(\d+)$/i);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('No pending selection');
    });

    it('should error if selection out of range', async () => {
      // Create pending selection
      actionContext.message = 'add milk';
      actionContext.match = 'add milk'.match(/^add\s+(.+)$/i);

      mockListOperations.searchMyItems.mockResolvedValue([
        { name: 'Wegmans 2% Milk', index: 0 },
        { name: 'Wegmans Whole Milk', index: 1 },
      ]);

      await action.execute(actionContext);

      // Pick invalid option
      actionContext.message = 'pick 99';
      actionContext.match = 'pick 99'.match(/^(?:pick|select|choose)\s+(\d+)$/i);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('between 1 and');
    });
  });

  describe('Remove Command', () => {
    it('should remove item from list', async () => {
      actionContext.message = 'remove milk';
      actionContext.match = 'remove milk'.match(/^remove\s+(.+)$/i);

      mockListOperations.removeItemFromList.mockResolvedValue(true);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed');
      expect(mockDB.removeGroceryItem).toHaveBeenCalledWith('milk');
    });

    it('should handle item not found', async () => {
      actionContext.message = 'remove nonexistent';
      actionContext.match = 'remove nonexistent'.match(/^remove\s+(.+)$/i);

      mockListOperations.removeItemFromList.mockResolvedValue(false);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Couldn't find");
    });
  });

  describe('List Command', () => {
    it('should show current list items', async () => {
      actionContext.message = 'list';
      actionContext.match = 'list'.match(/^(?:list|show\s+list|shopping\s+list)$/i);

      mockListOperations.getListItems.mockResolvedValue([
        { name: 'Milk', price: '$4.99' },
        { name: 'Eggs', price: '$5.99' },
      ]);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('2 items');
      expect(result.message).toContain('Milk');
      expect(result.message).toContain('Eggs');
    });

    it('should show empty list message', async () => {
      actionContext.message = 'list';
      actionContext.match = 'list'.match(/^(?:list|show\s+list|shopping\s+list)$/i);

      mockListOperations.getListItems.mockResolvedValue([]);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('empty');
    });

    it('should fall back to cached items on error', async () => {
      actionContext.message = 'list';
      actionContext.match = 'list'.match(/^(?:list|show\s+list|shopping\s+list)$/i);

      mockListOperations.getListItems.mockRejectedValue(new Error('Network error'));
      mockDB.getGroceryItems.mockReturnValue([
        { id: 1, name: 'Cached Milk', addedAt: new Date().toISOString() },
      ]);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Cached');
    });
  });

  describe('Clear Command', () => {
    it('should clear entire list', async () => {
      actionContext.message = 'clear list';
      actionContext.match = 'clear list'.match(/^clear\s+list$/i);

      mockListOperations.clearList.mockResolvedValue(true);
      mockDB.clearGroceryItems.mockReturnValue(5);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleared');
      expect(result.message).toContain('5 items');
    });

    it('should handle clear failure', async () => {
      actionContext.message = 'clear list';
      actionContext.match = 'clear list'.match(/^clear\s+list$/i);

      mockListOperations.clearList.mockResolvedValue(false);

      const result = await action.execute(actionContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed');
    });
  });

  describe('Pattern Matching', () => {
    it('should match "add" command variations', () => {
      expect('add milk'.match(action.patterns[0])).toBeTruthy();
      expect('Add Organic Milk'.match(action.patterns[0])).toBeTruthy();
      expect('ADD eggs and bread'.match(action.patterns[0])).toBeTruthy();
    });

    it('should match "search" command variations', () => {
      expect('search milk'.match(action.patterns[1])).toBeTruthy();
      expect('Search organic options'.match(action.patterns[1])).toBeTruthy();
    });

    it('should match "list" command variations', () => {
      expect('list'.match(action.patterns[3])).toBeTruthy();
      expect('show list'.match(action.patterns[3])).toBeTruthy();
      expect('shopping list'.match(action.patterns[3])).toBeTruthy();
    });

    it('should match "pick" command variations', () => {
      expect('pick 1'.match(action.patterns[5])).toBeTruthy();
      expect('select 2'.match(action.patterns[5])).toBeTruthy();
      expect('choose 3'.match(action.patterns[5])).toBeTruthy();
    });
  });
});
