import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { RuleManager } from './rule-manager.js';

describe('RuleManager', () => {
  const testRulesDir = './test-rules-manager';
  let manager: RuleManager;

  beforeEach(async () => {
    // Create test rules directory
    await fs.mkdir(testRulesDir, { recursive: true });
    manager = new RuleManager(testRulesDir);
  });

  afterEach(async () => {
    // Clean up test rules directory
    try {
      await fs.rm(testRulesDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getRuleContent', () => {
    it('should return rule content for existing domain', async () => {
      const testContent = `# React Rules

- Description: React development rules
- Version: 1.0

## Rules

Use functional components.`;

      await fs.writeFile(path.join(testRulesDir, 'react.md'), testContent);

      const result = await manager.getRuleContent('react');
      
      expect(result).not.toBeNull();
      expect(result?.domain).toBe('react');
      expect(result?.description).toBe('React development rules');
      expect(result?.version).toBe('1.0');
      expect(result?.content).toBe(testContent);
    });

    it('should return null for non-existent domain', async () => {
      const result = await manager.getRuleContent('non-existent');
      expect(result).toBeNull();
    });

    it('should cache results', async () => {
      const testContent = '# Cached Rule\n\nThis should be cached.';
      await fs.writeFile(path.join(testRulesDir, 'cached.md'), testContent);

      // First call
      const result1 = await manager.getRuleContent('cached');
      
      // Second call should use cache
      const result2 = await manager.getRuleContent('cached');
      
      expect(result1).toEqual(result2);
      expect(manager.getCacheStats().size).toBe(1);
      expect(manager.getCacheStats().domains).toContain('cached');
    });

    it('should handle file read errors gracefully', async () => {
      // Create a file then make it inaccessible (this is platform-specific)
      await fs.writeFile(path.join(testRulesDir, 'error.md'), 'content');
      
      // Mock console.error to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Delete the file to simulate an error
      await fs.unlink(path.join(testRulesDir, 'error.md'));
      
      const result = await manager.getRuleContent('error');
      expect(result).toBeNull();
      
      consoleSpy.mockRestore();
    });
  });

  describe('listAvailableDomains', () => {
    it('should return empty array for empty directory', async () => {
      const domains = await manager.listAvailableDomains();
      expect(domains).toEqual([]);
    });

    it('should return domain information for all rule files', async () => {
      await fs.writeFile(path.join(testRulesDir, 'react.md'), `# React Rules

- Description: React development rules
- Last Updated: 2025-08-27

Content here.`);

      await fs.writeFile(path.join(testRulesDir, 'vue.md'), `# Vue Rules

- Description: Vue.js development rules

Content here.`);

      const domains = await manager.listAvailableDomains();
      
      expect(domains).toHaveLength(2);
      
      const reactDomain = domains.find(d => d.domain === 'react');
      expect(reactDomain).toBeDefined();
      expect(reactDomain?.description).toBe('React development rules');
      expect(reactDomain?.lastUpdated).toBe('2025-08-27');
      
      const vueDomain = domains.find(d => d.domain === 'vue');
      expect(vueDomain).toBeDefined();
      expect(vueDomain?.description).toBe('Vue.js development rules');
    });

    it('should handle files with missing metadata gracefully', async () => {
      await fs.writeFile(path.join(testRulesDir, 'simple.md'), '# Simple Rule\n\nNo metadata here.');

      const domains = await manager.listAvailableDomains();
      
      expect(domains).toHaveLength(1);
      expect(domains[0].domain).toBe('simple');
      expect(domains[0].description).toBe('Rules for simple');
    });

    it('should continue processing when individual files fail', async () => {
      // Create valid file
      await fs.writeFile(path.join(testRulesDir, 'valid.md'), `# Valid Rule

- Description: Valid rule

Content.`);

      // Create invalid file (empty)
      await fs.writeFile(path.join(testRulesDir, 'invalid.md'), '');

      // Mock console.warn to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const domains = await manager.listAvailableDomains();
      
      expect(domains).toHaveLength(2);
      
      const validDomain = domains.find(d => d.domain === 'valid');
      expect(validDomain?.description).toBe('Valid rule');
      
      const invalidDomain = domains.find(d => d.domain === 'invalid');
      expect(invalidDomain?.description).toContain('Rules for invalid');
      
      consoleSpy.mockRestore();
    });
  });

  describe('getRuleContentSafe', () => {
    it('should handle concurrent requests to same domain', async () => {
      const testContent = '# Concurrent Rule\n\nTesting concurrent access.';
      await fs.writeFile(path.join(testRulesDir, 'concurrent.md'), testContent);

      // Make multiple concurrent requests
      const promises = [
        manager.getRuleContentSafe('concurrent'),
        manager.getRuleContentSafe('concurrent'),
        manager.getRuleContentSafe('concurrent')
      ];

      const results = await Promise.all(promises);
      
      // All results should be identical
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
      expect(results[0]?.domain).toBe('concurrent');
    });
  });

  describe('cache management', () => {
    it('should clear cache for specific domain', async () => {
      await fs.writeFile(path.join(testRulesDir, 'test1.md'), '# Test 1');
      await fs.writeFile(path.join(testRulesDir, 'test2.md'), '# Test 2');

      // Load both into cache
      await manager.getRuleContent('test1');
      await manager.getRuleContent('test2');

      expect(manager.getCacheStats().size).toBe(2);

      // Clear specific domain
      manager.clearCache('test1');

      const stats = manager.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.domains).toContain('test2');
      expect(stats.domains).not.toContain('test1');
    });

    it('should clear all cache', async () => {
      await fs.writeFile(path.join(testRulesDir, 'test1.md'), '# Test 1');
      await fs.writeFile(path.join(testRulesDir, 'test2.md'), '# Test 2');

      // Load both into cache
      await manager.getRuleContent('test1');
      await manager.getRuleContent('test2');

      expect(manager.getCacheStats().size).toBe(2);

      // Clear all cache
      manager.clearCache();

      const stats = manager.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.domains).toEqual([]);
    });

    it('should provide cache statistics', async () => {
      await fs.writeFile(path.join(testRulesDir, 'stats.md'), '# Stats Test');

      const initialStats = manager.getCacheStats();
      expect(initialStats.size).toBe(0);
      expect(initialStats.domains).toEqual([]);

      await manager.getRuleContent('stats');

      const afterStats = manager.getCacheStats();
      expect(afterStats.size).toBe(1);
      expect(afterStats.domains).toEqual(['stats']);
    });
  });

  describe('getRulesDirectory', () => {
    it('should return the rules directory path', () => {
      const directory = manager.getRulesDirectory();
      expect(directory).toBe(path.resolve(testRulesDir));
    });
  });
});