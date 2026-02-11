import { vi } from 'vitest';

export interface MockGroceryItem {
  id: number;
  name: string;
  addedAt: string;
}

export function createMockDB() {
  const groceryItems: MockGroceryItem[] = [];
  const messages: Array<{ sender: string; message: string; response: string }> = [];

  return {
    addGroceryItem: vi.fn().mockImplementation((name: string) => {
      const item = {
        id: groceryItems.length + 1,
        name,
        addedAt: new Date().toISOString(),
      };
      groceryItems.push(item);
      return item;
    }),

    removeGroceryItem: vi.fn().mockImplementation((name: string) => {
      const index = groceryItems.findIndex(
        (item) => item.name.toLowerCase().includes(name.toLowerCase())
      );
      if (index !== -1) {
        groceryItems.splice(index, 1);
        return true;
      }
      return false;
    }),

    getGroceryItems: vi.fn().mockImplementation(() => [...groceryItems]),

    clearGroceryItems: vi.fn().mockImplementation(() => {
      const count = groceryItems.length;
      groceryItems.length = 0;
      return count;
    }),

    logMessage: vi.fn().mockImplementation((sender: string, message: string, response: string) => {
      messages.push({ sender, message, response });
    }),

    close: vi.fn(),

    // Test helpers
    _getItems: () => [...groceryItems],
    _getMessages: () => [...messages],
    _reset: () => {
      groceryItems.length = 0;
      messages.length = 0;
    },
  };
}

export type MockDB = ReturnType<typeof createMockDB>;
