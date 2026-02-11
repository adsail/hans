import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockDB } from '../mocks/db.mock.js';
import { createMockBrowserPool, createMockPage } from '../mocks/browser.mock.js';

// Mock function references
const mockChat = vi.fn();
const mockAddFunctionResult = vi.fn();
const mockContinueWithFunctionResults = vi.fn();
const mockClearHistory = vi.fn();

// Mock GeminiService as a class
class MockGeminiService {
  chat = mockChat;
  addFunctionResult = mockAddFunctionResult;
  continueWithFunctionResults = mockContinueWithFunctionResults;
  clearHistory = mockClearHistory;
}

vi.mock('../../src/llm/gemini.js', () => ({
  GeminiService: MockGeminiService,
}));

// Mock WegmansBrowser
const mockWithPage = vi.fn();

class MockWegmansBrowser {
  withPage = mockWithPage;
}

vi.mock('../../src/actions/wegmans/browser.js', () => ({
  WegmansBrowser: MockWegmansBrowser,
}));

// Mock list operations
vi.mock('../../src/actions/wegmans/list.js', () => ({
  searchMyItems: vi.fn().mockResolvedValue([]),
  searchProducts: vi.fn().mockResolvedValue([]),
  addMyItemToList: vi.fn().mockResolvedValue(true),
  addSearchResultToList: vi.fn().mockResolvedValue(true),
  removeItemFromList: vi.fn().mockResolvedValue(true),
  getListItems: vi.fn().mockResolvedValue([]),
  clearList: vi.fn().mockResolvedValue(true),
}));

describe('HansAgent', () => {
  let agent: Awaited<ReturnType<typeof createTestAgent>>;
  let mockDB: ReturnType<typeof createMockDB>;
  let mockBrowserPool: ReturnType<typeof createMockBrowserPool>;

  async function createTestAgent() {
    const { HansAgent } = await import('../../src/llm/agent.js');
    return new HansAgent('test-api-key', {
      browserPool: mockBrowserPool as any,
      db: mockDB as any,
      config: {
        ownerPhoneNumber: '12025551234@c.us',
        geminiApiKey: 'test-key',
        wegmans: { email: 'test@example.com', password: 'password' },
        logLevel: 'info',
        dataPath: './data',
        whatsappSessionPath: './data/whatsapp-session',
        browserStatePath: './data/browser-state',
        dbPath: './data/hans.db',
      },
    });
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDB = createMockDB();
    mockBrowserPool = createMockBrowserPool();

    // Default mock for withPage
    mockWithPage.mockImplementation(async (fn: any) => {
      const mockPage = createMockPage();
      return fn(mockPage);
    });

    // Reset Gemini mocks
    mockChat.mockReset();
    mockAddFunctionResult.mockReset();
    mockContinueWithFunctionResults.mockReset();
    mockClearHistory.mockReset();

    vi.resetModules();
    agent = await createTestAgent();
  });

  describe('Natural Language Understanding', () => {
    it('should handle simple greeting', async () => {
      mockChat.mockResolvedValueOnce({
        text: "Hey! I'm Hans, your grocery assistant. What can I help you with?",
      });

      const response = await agent.handleMessage('user123', 'hello');

      expect(response).toContain('Hans');
      expect(mockChat).toHaveBeenCalledWith('user123', 'hello');
    });

    it('should handle help request', async () => {
      mockChat.mockResolvedValueOnce({
        text: 'I can help you manage your Wegmans grocery list! Try saying "add milk" or "show my list".',
      });

      const response = await agent.handleMessage('user123', 'what can you do?');

      expect(response).toContain('grocery');
      expect(mockChat).toHaveBeenCalled();
    });
  });

  describe('Function Calling - Add Items', () => {
    it('should add single item via function call', async () => {
      mockChat.mockResolvedValueOnce({
        functionCalls: [
          { name: 'add_to_grocery_list', args: { items: ['milk'] } },
        ],
      });

      mockContinueWithFunctionResults.mockResolvedValueOnce({
        text: 'Added milk to your list!',
      });

      const response = await agent.handleMessage('user123', 'add milk');

      expect(response).toBe('Added milk to your list!');
      expect(mockAddFunctionResult).toHaveBeenCalled();
    });

    it('should add multiple items in one request', async () => {
      mockChat.mockResolvedValueOnce({
        functionCalls: [
          { name: 'add_to_grocery_list', args: { items: ['eggs', 'milk', 'bread'] } },
        ],
      });

      mockContinueWithFunctionResults.mockResolvedValueOnce({
        text: 'Added eggs, milk, and bread to your list!',
      });

      const response = await agent.handleMessage('user123', 'I need eggs, milk, and bread');

      expect(response).toContain('eggs');
      expect(response).toContain('milk');
      expect(response).toContain('bread');
    });
  });

  describe('Function Calling - Show List', () => {
    it('should show empty list', async () => {
      mockChat.mockResolvedValueOnce({
        functionCalls: [
          { name: 'show_grocery_list', args: {} },
        ],
      });

      mockContinueWithFunctionResults.mockResolvedValueOnce({
        text: 'Your shopping list is empty. Add something with "add [item]".',
      });

      const response = await agent.handleMessage('user123', "what's on my list?");

      expect(response).toContain('empty');
    });
  });

  describe('Function Calling - Remove Items', () => {
    it('should remove item from list', async () => {
      mockChat.mockResolvedValueOnce({
        functionCalls: [
          { name: 'remove_from_grocery_list', args: { item: 'milk' } },
        ],
      });

      mockContinueWithFunctionResults.mockResolvedValueOnce({
        text: 'Removed milk from your list.',
      });

      const response = await agent.handleMessage('user123', 'remove the milk');

      expect(response).toContain('Removed');
      expect(response).toContain('milk');
    });
  });

  describe('Function Calling - Clear List', () => {
    it('should clear entire list', async () => {
      mockChat.mockResolvedValueOnce({
        functionCalls: [
          { name: 'clear_grocery_list', args: {} },
        ],
      });

      mockContinueWithFunctionResults.mockResolvedValueOnce({
        text: 'Cleared your shopping list. Starting fresh!',
      });

      const response = await agent.handleMessage('user123', 'clear everything');

      expect(response).toContain('Clear');
    });
  });

  describe('Function Calling - Select Item', () => {
    it('should select item from options', async () => {
      mockChat.mockResolvedValueOnce({
        functionCalls: [
          { name: 'select_item', args: { selection: 2 } },
        ],
      });

      mockContinueWithFunctionResults.mockResolvedValueOnce({
        text: 'Added Wegmans Organic Eggs to your list.',
      });

      const response = await agent.handleMessage('user123', 'the second one');

      expect(response).toContain('Added');
    });
  });

  describe('Function Calling - Search', () => {
    it('should search full catalog', async () => {
      mockChat.mockResolvedValueOnce({
        functionCalls: [
          { name: 'search_grocery_item', args: { query: 'organic almond milk' } },
        ],
      });

      mockContinueWithFunctionResults.mockResolvedValueOnce({
        text: 'Found 3 options for organic almond milk. Which one would you like?',
      });

      const response = await agent.handleMessage('user123', 'find organic almond milk');

      expect(response).toContain('Found');
    });
  });

  describe('Chained Function Calls', () => {
    it('should handle multiple function calls in sequence', async () => {
      mockChat.mockResolvedValueOnce({
        functionCalls: [{ name: 'show_grocery_list', args: {} }],
      });

      mockContinueWithFunctionResults
        .mockResolvedValueOnce({
          functionCalls: [{ name: 'show_grocery_list', args: {} }],
        })
        .mockResolvedValueOnce({
          text: 'Your list is empty.',
        });

      const response = await agent.handleMessage('user123', 'show list');

      expect(mockContinueWithFunctionResults).toHaveBeenCalledTimes(2);
      expect(response).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle Gemini API errors gracefully', async () => {
      mockChat.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      const response = await agent.handleMessage('user123', 'add milk');

      expect(response).toContain('wrong');
    });

    it('should handle malformed function call args', async () => {
      mockChat.mockResolvedValueOnce({
        functionCalls: [
          { name: 'add_to_grocery_list', args: {} },
        ],
      });

      mockContinueWithFunctionResults.mockResolvedValueOnce({
        text: 'I had trouble with that. Could you try again?',
      });

      const response = await agent.handleMessage('user123', 'add something');

      expect(response).toBeDefined();
    });

    it('should handle unknown function names', async () => {
      mockChat.mockResolvedValueOnce({
        functionCalls: [
          { name: 'unknown_function', args: {} },
        ],
      });

      mockContinueWithFunctionResults.mockResolvedValueOnce({
        text: "I couldn't do that. Try something else?",
      });

      const response = await agent.handleMessage('user123', 'do something weird');

      expect(response).toBeDefined();
    });
  });

  describe('Context Management', () => {
    it('should clear context when requested', async () => {
      agent.clearContext('user123');

      expect(mockClearHistory).toHaveBeenCalledWith('user123');
    });

    it('should maintain separate contexts for different users', async () => {
      mockChat.mockResolvedValue({ text: 'Hi!' });

      await agent.handleMessage('user1', 'hello');
      await agent.handleMessage('user2', 'hello');

      expect(mockChat).toHaveBeenCalledWith('user1', 'hello');
      expect(mockChat).toHaveBeenCalledWith('user2', 'hello');
    });
  });

  describe('Iteration Limit', () => {
    it('should stop after max iterations to prevent infinite loops', async () => {
      mockChat.mockResolvedValueOnce({
        functionCalls: [{ name: 'show_grocery_list', args: {} }],
      });

      // Return function calls multiple times
      mockContinueWithFunctionResults
        .mockResolvedValueOnce({ functionCalls: [{ name: 'show_grocery_list', args: {} }] })
        .mockResolvedValueOnce({ functionCalls: [{ name: 'show_grocery_list', args: {} }] })
        .mockResolvedValueOnce({ functionCalls: [{ name: 'show_grocery_list', args: {} }] })
        .mockResolvedValueOnce({ functionCalls: [{ name: 'show_grocery_list', args: {} }] })
        .mockResolvedValueOnce({ functionCalls: [{ name: 'show_grocery_list', args: {} }] })
        .mockResolvedValueOnce({ text: 'Done!' });

      const response = await agent.handleMessage('user123', 'show list');

      // Should complete without hanging (max 5 iterations)
      expect(mockContinueWithFunctionResults.mock.calls.length).toBeLessThanOrEqual(5);
      expect(response).toBeDefined();
    });
  });
});
