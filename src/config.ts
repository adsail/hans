import path from 'path';

export interface Config {
  ownerPhoneNumber: string;
  geminiApiKey: string;
  wegmans: {
    email: string;
    password: string;
  };
  logLevel: string;
  dataPath: string;
  whatsappSessionPath: string;
  browserStatePath: string;
  dbPath: string;
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export function loadConfig(): Config {
  const dataPath = getEnvOrDefault('DATA_PATH', './data');

  return {
    ownerPhoneNumber: getEnvOrThrow('OWNER_PHONE_NUMBER'),
    geminiApiKey: getEnvOrThrow('GEMINI_API_KEY'),
    wegmans: {
      email: getEnvOrThrow('WEGMANS_EMAIL'),
      password: getEnvOrThrow('WEGMANS_PASSWORD'),
    },
    logLevel: getEnvOrDefault('LOG_LEVEL', 'info'),
    dataPath,
    whatsappSessionPath: path.join(dataPath, 'whatsapp-session'),
    browserStatePath: path.join(dataPath, 'browser-state'),
    dbPath: path.join(dataPath, 'hans.db'),
  };
}
