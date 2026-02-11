import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

describe('Config', () => {
  beforeEach(() => {
    // Reset modules to get fresh config
    vi.resetModules();
    // Clear all env vars we care about
    delete process.env.OWNER_PHONE_NUMBER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.WEGMANS_EMAIL;
    delete process.env.WEGMANS_PASSWORD;
    delete process.env.LOG_LEVEL;
    delete process.env.DATA_PATH;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it('should throw if OWNER_PHONE_NUMBER is missing', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.WEGMANS_EMAIL = 'test@example.com';
    process.env.WEGMANS_PASSWORD = 'password';

    const { loadConfig } = await import('../../src/config.js');
    expect(() => loadConfig()).toThrow('Missing required environment variable: OWNER_PHONE_NUMBER');
  });

  it('should throw if GEMINI_API_KEY is missing', async () => {
    process.env.OWNER_PHONE_NUMBER = '12025551234@c.us';
    process.env.WEGMANS_EMAIL = 'test@example.com';
    process.env.WEGMANS_PASSWORD = 'password';

    const { loadConfig } = await import('../../src/config.js');
    expect(() => loadConfig()).toThrow('Missing required environment variable: GEMINI_API_KEY');
  });

  it('should throw if WEGMANS_EMAIL is missing', async () => {
    process.env.OWNER_PHONE_NUMBER = '12025551234@c.us';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.WEGMANS_PASSWORD = 'password';

    const { loadConfig } = await import('../../src/config.js');
    expect(() => loadConfig()).toThrow('Missing required environment variable: WEGMANS_EMAIL');
  });

  it('should throw if WEGMANS_PASSWORD is missing', async () => {
    process.env.OWNER_PHONE_NUMBER = '12025551234@c.us';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.WEGMANS_EMAIL = 'test@example.com';

    const { loadConfig } = await import('../../src/config.js');
    expect(() => loadConfig()).toThrow('Missing required environment variable: WEGMANS_PASSWORD');
  });

  it('should load config with all required values', async () => {
    process.env.OWNER_PHONE_NUMBER = '12025551234@c.us';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.WEGMANS_EMAIL = 'test@example.com';
    process.env.WEGMANS_PASSWORD = 'password123';

    const { loadConfig } = await import('../../src/config.js');
    const config = loadConfig();

    expect(config.ownerPhoneNumber).toBe('12025551234@c.us');
    expect(config.geminiApiKey).toBe('test-gemini-key');
    expect(config.wegmans.email).toBe('test@example.com');
    expect(config.wegmans.password).toBe('password123');
  });

  it('should use default values for optional config', async () => {
    process.env.OWNER_PHONE_NUMBER = '12025551234@c.us';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.WEGMANS_EMAIL = 'test@example.com';
    process.env.WEGMANS_PASSWORD = 'password';

    const { loadConfig } = await import('../../src/config.js');
    const config = loadConfig();

    expect(config.logLevel).toBe('info');
    expect(config.dataPath).toBe('./data');
  });

  it('should use custom values when provided', async () => {
    process.env.OWNER_PHONE_NUMBER = '12025551234@c.us';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.WEGMANS_EMAIL = 'test@example.com';
    process.env.WEGMANS_PASSWORD = 'password';
    process.env.LOG_LEVEL = 'debug';
    process.env.DATA_PATH = '/custom/path';

    const { loadConfig } = await import('../../src/config.js');
    const config = loadConfig();

    expect(config.logLevel).toBe('debug');
    expect(config.dataPath).toBe('/custom/path');
  });

  it('should construct correct paths for session data', async () => {
    process.env.OWNER_PHONE_NUMBER = '12025551234@c.us';
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.WEGMANS_EMAIL = 'test@example.com';
    process.env.WEGMANS_PASSWORD = 'password';
    process.env.DATA_PATH = '/app/data';

    const { loadConfig } = await import('../../src/config.js');
    const config = loadConfig();

    expect(config.whatsappSessionPath).toBe('/app/data/whatsapp-session');
    expect(config.browserStatePath).toBe('/app/data/browser-state');
    expect(config.dbPath).toBe('/app/data/hans.db');
  });
});
