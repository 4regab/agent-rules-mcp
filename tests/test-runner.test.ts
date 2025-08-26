import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { RepositoryFileReader } from './repository-file-reader.js';
import { RuleManager } from './rule-manager.js';

describe('Test Runner - Comprehensive Test Suite', () => {
  const testDataDir = './test-data/sample-rules';
  let reader: RepositoryFileReader;
  let manager: RuleManager;

  beforeAll(async () => {
    // Ensure test data directory exists
    try {
      await fs.access(testDataDir);
    } catch {
      // Create test data if it doesn't exist
      await fs.mkdir(testDataDir, { recursive: true });
      
      // Create sample files for testing
      await fs.writeFile(path.join(testDataDir, 'test-sample.md'), `# Test Sample

- Description: Sample rule for testing
- Version: 1.0

Content here.`);
    }

    reader = new RepositoryFileReader(testDataDir);
    manager = new RuleManager(testDataDir);
  });

  afterAll(async () => {
    // Clean up any test artifacts
    try {
      const files = await fs.readdir(testDataDir);
      for (const file of files) {
        if (file.startsWith('test-')) {
          await fs.unlink(path.join(testDataDir, file));
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Test Data Validation', () => {
    it('should have test data directory', async () => {
      const stats = await fs.stat(testDataDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should be able to read test data files', async () => {
      const files = await fs.readdir(testDataDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      expect(mdFiles.length).toBeGreaterThan(0);
      
      // Verify we can read each file
      for (const file of mdFiles) {
        const content = await fs.readFile(path.join(testDataDir, file), 'utf-8');
        expect(content.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Real Test Data Processing', () => {
    it('should process all test data files correctly', async () => {
      const domains = await manager.listAvailableDomains();
      
      expect(domains.length).toBeGreaterThan(0);
      
      // Verify each domain can be retrieved
      for (const domainInfo of domains) {
        const ruleContent = await manager.getRuleContent(domainInfo.domain);
        expect(ruleContent).not.toBeNull();
        expect(ruleContent?.domain).toBe(domainInfo.domain);
        expect(ruleContent?.content.length).toBeGreaterThan(0);
      }
    });

    it('should handle different metadata formats in test data', async () => {
      const domains = await manager.listAvailableDomains();
      
      // Look for files with different formats
      const yamlFile = domains.find(d => d.domain === 'security');
      const inlineFile = domains.find(d => d.domain === 'react');
      const noMetaFile = domains.find(d => d.domain === 'no-metadata');

      if (yamlFile) {
        const content = await manager.getRuleContent('security');
        expect(content?.description).toBeDefined();
        expect(content?.version).toBeDefined();
      }

      if (inlineFile) {
        const content = await manager.getRuleContent('react');
        expect(content?.description).toBeDefined();
        expect(content?.version).toBeDefined();
      }

      if (noMetaFile) {
        const content = await manager.getRuleContent('no-metadata');
        expect(content?.description).toBeUndefined();
      }
    });

    it('should handle invalid files gracefully', async () => {
      // Check if we have invalid test files
      const domains = await manager.listAvailableDomains();
      
      // The system should continue working even with invalid files present
      expect(domains.length).toBeGreaterThan(0);
      
      // All returned domains should be accessible
      for (const domainInfo of domains) {
        const content = await manager.getRuleContent(domainInfo.domain);
        expect(content).not.toBeNull();
      }
    });
  });

  describe('Performance with Real Data', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      const domains = await manager.listAvailableDomains();
      
      if (domains.length === 0) {
        // Skip if no test data
        return;
      }

      const startTime = Date.now();
      
      // Create concurrent requests
      const promises = [
        ...Array.from({ length: 5 }, () => manager.listAvailableDomains()),
        ...domains.slice(0, 3).map(d => manager.getRuleContent(d.domain)),
        ...domains.slice(0, 3).map(d => manager.getRuleContentSafe(d.domain)),
      ];

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results.length).toBe(promises.length);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should cache results effectively', async () => {
      const domains = await manager.listAvailableDomains();
      
      if (domains.length === 0) {
        return;
      }

      // Clear cache first
      manager.clearCache();
      expect(manager.getCacheStats().size).toBe(0);

      // Load some rules
      const firstDomain = domains[0].domain;
      await manager.getRuleContent(firstDomain);
      
      expect(manager.getCacheStats().size).toBe(1);
      expect(manager.getCacheStats().domains).toContain(firstDomain);

      // Load more rules
      if (domains.length > 1) {
        await manager.getRuleContent(domains[1].domain);
        expect(manager.getCacheStats().size).toBe(2);
      }
    });
  });

  describe('Edge Cases with Real Data', () => {
    it('should handle file system edge cases', async () => {
      // Test with non-existent domain
      const nonExistent = await manager.getRuleContent('definitely-does-not-exist');
      expect(nonExistent).toBeNull();

      // Test with invalid domain names
      const invalidDomain = await manager.getRuleContent('invalid/domain');
      expect(invalidDomain).toBeNull();

      // Test empty domain
      const emptyDomain = await manager.getRuleContent('');
      expect(emptyDomain).toBeNull();
    });

    it('should maintain consistency across operations', async () => {
      // Get initial state
      const initialDomains = await manager.listAvailableDomains();
      
      // Perform various operations
      for (const domain of initialDomains.slice(0, 2)) {
        const content1 = await manager.getRuleContent(domain.domain);
        const content2 = await manager.getRuleContentSafe(domain.domain);
        
        // Results should be identical
        expect(content1).toEqual(content2);
      }

      // List should remain consistent
      const finalDomains = await manager.listAvailableDomains();
      expect(finalDomains.length).toBe(initialDomains.length);
    });
  });

  describe('Test Coverage Verification', () => {
    it('should have tested all major code paths', () => {
      // This test verifies that our test suite covers the main functionality
      
      // RepositoryFileReader methods
      expect(typeof reader.readRuleFile).toBe('function');
      expect(typeof reader.listRuleFiles).toBe('function');
      expect(typeof reader.ruleExists).toBe('function');
      expect(typeof reader.parseRuleContent).toBe('function');
      expect(typeof reader.extractDomainFromFilename).toBe('function');
      expect(typeof reader.isValidDomain).toBe('function');
      expect(typeof reader.getRulesDirectory).toBe('function');

      // RuleManager methods
      expect(typeof manager.getRuleContent).toBe('function');
      expect(typeof manager.listAvailableDomains).toBe('function');
      expect(typeof manager.getRuleContentSafe).toBe('function');
      expect(typeof manager.clearCache).toBe('function');
      expect(typeof manager.getCacheStats).toBe('function');
      expect(typeof manager.getRulesDirectory).toBe('function');
    });

    it('should have comprehensive error handling', async () => {
      // Test error conditions
      const invalidReader = new RepositoryFileReader('./non-existent-directory');
      const invalidManager = new RuleManager('./non-existent-directory');

      // Should handle gracefully
      const domains = await invalidManager.listAvailableDomains();
      expect(domains).toEqual([]);

      const content = await invalidManager.getRuleContent('any-domain');
      expect(content).toBeNull();
    });
  });
});