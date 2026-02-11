import { vi } from 'vitest';

export function createMockPage() {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    $: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockResolvedValue([]),
    $$eval: vi.fn().mockResolvedValue([]),
    url: vi.fn().mockReturnValue('https://www.wegmans.com'),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
    },
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockBrowserContext() {
  const mockPage = createMockPage();

  return {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
    storageState: vi.fn().mockResolvedValue(undefined),
    _mockPage: mockPage,
  };
}

export function createMockBrowserPool() {
  const mockContext = createMockBrowserContext();

  return {
    getBrowser: vi.fn().mockResolvedValue({
      isConnected: () => true,
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    }),
    getContext: vi.fn().mockResolvedValue(mockContext),
    saveContextState: vi.fn().mockResolvedValue(undefined),
    closeContext: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    _mockContext: mockContext,
    _mockPage: mockContext._mockPage,
  };
}

export type MockBrowserPool = ReturnType<typeof createMockBrowserPool>;
export type MockPage = ReturnType<typeof createMockPage>;
