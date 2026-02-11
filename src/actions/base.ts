import type { DB } from '../db/sqlite.js';
import type { BrowserPool } from '../browser/pool.js';
import type { Config } from '../config.js';

export interface ActionContext {
  message: string;
  match: RegExpMatchArray;
  db: DB;
  browserPool: BrowserPool;
  config: Config;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface Action {
  name: string;
  description: string;
  patterns: RegExp[];
  execute(context: ActionContext): Promise<ActionResult>;
}
