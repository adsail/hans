import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DB } from '../../src/db/sqlite.js';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = '/tmp/claude/hans-test.db';

describe('DB', () => {
  let db: DB;

  beforeEach(() => {
    // Ensure test directory exists
    const dir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Remove existing test db
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new DB(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Grocery Items', () => {
    it('should add a grocery item', () => {
      const item = db.addGroceryItem('Milk');
      expect(item).toBeDefined();
      expect(item.name).toBe('Milk');
      expect(item.id).toBe(1);
    });

    it('should add multiple items with incrementing IDs', () => {
      const item1 = db.addGroceryItem('Milk');
      const item2 = db.addGroceryItem('Eggs');
      const item3 = db.addGroceryItem('Bread');

      expect(item1.id).toBe(1);
      expect(item2.id).toBe(2);
      expect(item3.id).toBe(3);
    });

    it('should get all grocery items', () => {
      db.addGroceryItem('Milk');
      db.addGroceryItem('Eggs');
      db.addGroceryItem('Bread');

      const items = db.getGroceryItems();
      expect(items).toHaveLength(3);
      expect(items.map((i) => i.name)).toEqual(['Milk', 'Eggs', 'Bread']);
    });

    it('should return empty array when no items', () => {
      const items = db.getGroceryItems();
      expect(items).toEqual([]);
    });

    it('should remove a grocery item by exact name', () => {
      db.addGroceryItem('Milk');
      db.addGroceryItem('Eggs');

      const removed = db.removeGroceryItem('Milk');
      expect(removed).toBe(true);

      const items = db.getGroceryItems();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Eggs');
    });

    it('should remove item by exact name match (case-insensitive)', () => {
      db.addGroceryItem('Organic Whole Milk');
      db.addGroceryItem('Eggs');

      // Exact match required (case-insensitive)
      const removed = db.removeGroceryItem('organic whole milk');
      expect(removed).toBe(true);

      const items = db.getGroceryItems();
      expect(items).toHaveLength(1);
    });

    it('should return false when removing non-existent item', () => {
      db.addGroceryItem('Milk');

      const removed = db.removeGroceryItem('Bread');
      expect(removed).toBe(false);

      const items = db.getGroceryItems();
      expect(items).toHaveLength(1);
    });

    it('should clear all grocery items', () => {
      db.addGroceryItem('Milk');
      db.addGroceryItem('Eggs');
      db.addGroceryItem('Bread');

      const count = db.clearGroceryItems();
      expect(count).toBe(3);

      const items = db.getGroceryItems();
      expect(items).toEqual([]);
    });

    it('should return 0 when clearing empty list', () => {
      const count = db.clearGroceryItems();
      expect(count).toBe(0);
    });
  });

  describe('Message Logging', () => {
    it('should log a message', () => {
      // This should not throw
      db.logMessage('user', 'add milk', 'Added milk to your list');
    });

    it('should handle special characters in messages', () => {
      db.logMessage('user', "add milk & eggs", "Added items: milk, eggs");
      db.logMessage('user', 'search "organic"', 'Found 3 items');
    });
  });

  describe('Persistence', () => {
    it('should persist data across DB instances', () => {
      db.addGroceryItem('Milk');
      db.addGroceryItem('Eggs');
      db.close();

      // Reopen database
      const db2 = new DB(TEST_DB_PATH);
      const items = db2.getGroceryItems();
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.name)).toEqual(['Milk', 'Eggs']);
      db2.close();

      // Reassign for cleanup
      db = new DB(TEST_DB_PATH);
    });
  });
});
