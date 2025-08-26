import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { RuleManager } from './rule-manager.js';
import { RepositoryFileReader } from './repository-file-reader.js';

describe('Integration Tests', () => {
  const testRulesDir = './test-rules-integration';

  beforeEach(async () => {
    // Create test rules directory
    await fs.mkdir(testRulesDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test rules directory
    try {
      await fs.rm(testRulesDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Full workflow integration', () => {
    it('should handle complete rule lifecycle', async () => {
      const reader = new RepositoryFileReader(testRulesDir);
      const manager = new RuleManager(testRulesDir);

      // 1. Start with empty directory
      let domains = await manager.listAvailableDomains();
      expect(domains).toEqual([]);

      // 2. Add a rule file
      const reactContent = `# React Rules

- Description: React development best practices
- Version: 1.0
- Last Updated: 2025-08-27

## Best Practices

1. Use functional components
2. Use hooks for state management
3. Keep components small and focused`;

      await fs.writeFile(path.join(testRulesDir, 'react.md'), reactContent);

      // 3. Verify it's detected
      domains = await manager.listAvailableDomains();
      expect(domains).toHaveLength(1);
      expect(domains[0].domain).toBe('react');
      expect(domains[0].description).toBe('React development best practices');

      // 4. Retrieve the content
      const ruleContent = await manager.getRuleContent('react');
      expect(ruleContent).not.toBeNull();
      expect(ruleContent?.domain).toBe('react');
      expect(ruleContent?.content).toBe(reactContent);
      expect(ruleContent?.version).toBe('1.0');

      // 5. Add another rule file
      const securityContent = `---
description: Security best practices for web applications
version: 2.0
last_updated: 2025-08-27
---

# Security Rules

## Authentication
- Use strong passwords
- Implement 2FA

## Data Protection
- Encrypt sensitive data
- Use HTTPS everywhere`;

      await fs.writeFile(path.join(testRulesDir, 'security.md'), securityContent);

      // 6. Verify both are available
      domains = await manager.listAvailableDomains();
      expect(domains).toHaveLength(2);
      
      const securityDomain = domains.find(d => d.domain === 'security');
      expect(securityDomain).toBeDefined();
      expect(securityDomain?.description).toBe('Security best practices for web applications');

      // 7. Test caching behavior
      const firstRead = await manager.getRuleContent('react');
      const secondRead = await manager.getRuleContent('react');
      expect(firstRead).toEqual(secondRead);
      expect(manager.getCacheStats().size).toBe(2); // Both rules should be cached

      // 8. Test cache clearing
      manager.clearCache('react');
      expect(manager.getCacheStats().size).toBe(1);
      expect(manager.getCacheStats().domains).toContain('security');
      expect(manager.getCacheStats().domains).not.toContain('react');

      // 9. Remove a file and verify it's no longer available
      await fs.unlink(path.join(testRulesDir, 'react.md'));
      
      // Clear cache to force re-read
      manager.clearCache();
      
      domains = await manager.listAvailableDomains();
      expect(domains).toHaveLength(1);
      expect(domains[0].domain).toBe('security');

      const removedRule = await manager.getRuleContent('react');
      expect(removedRule).toBeNull();
    });

    it('should handle mixed file formats and error conditions', async () => {
      const manager = new RuleManager(testRulesDir);

      // Create valid files with different formats
      await fs.writeFile(path.join(testRulesDir, 'inline-meta.md'), `# Inline Metadata

- Description: Using inline metadata format
- Version: 1.0

Content here.`);

      await fs.writeFile(path.join(testRulesDir, 'yaml-meta.md'), `---
description: Using YAML frontmatter format
version: 2.0
---

# YAML Metadata

Content here.`);

      await fs.writeFile(path.join(testRulesDir, 'no-meta.md'), `# No Metadata

Just plain content without any metadata.`);

      // Create invalid files that should be skipped
      await fs.writeFile(path.join(testRulesDir, 'empty.md'), '');
      await fs.writeFile(path.join(testRulesDir, 'not-markdown.txt'), 'This is not a markdown file');
      await fs.writeFile(path.join(testRulesDir, 'invalid domain.md'), '# Invalid domain name');

      // Mock console methods to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const domains = await manager.listAvailableDomains();

      // Should only include valid markdown files with valid domain names
      expect(domains.length).toBeGreaterThanOrEqual(3);
      
      const domainNames = domains.map(d => d.domain).sort();
      expect(domainNames).toContain('inline-meta');
      expect(domainNames).toContain('no-meta');
      expect(domainNames).toContain('yaml-meta');

      // Verify each format is parsed correctly
      const inlineMeta = await manager.getRuleContent('inline-meta');
      expect(inlineMeta?.description).toBe('Using inline metadata format');
      expect(inlineMeta?.version).toBe('1.0');

      const yamlMeta = await manager.getRuleContent('yaml-meta');
      expect(yamlMeta?.description).toBe('Using YAML frontmatter format');
      expect(yamlMeta?.version).toBe('2.0');

      const noMeta = await manager.getRuleContent('no-meta');
      expect(noMeta?.description).toBeUndefined();
      expect(noMeta?.version).toBeUndefined();

      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should handle concurrent access patterns', async () => {
      const manager = new RuleManager(testRulesDir);

      // Create multiple rule files
      const ruleFiles = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5'];
      
      for (const ruleName of ruleFiles) {
        await fs.writeFile(
          path.join(testRulesDir, `${ruleName}.md`),
          `# ${ruleName.toUpperCase()} Rules\n\n- Description: Rules for ${ruleName}\n\nContent for ${ruleName}.`
        );
      }

      // Simulate concurrent access patterns
      const concurrentOperations = [
        // Multiple list operations
        ...Array.from({ length: 3 }, () => manager.listAvailableDomains()),
        // Multiple get operations for same domain
        ...Array.from({ length: 3 }, () => manager.getRuleContentSafe('rule1')),
        // Multiple get operations for different domains
        ...ruleFiles.map(rule => manager.getRuleContentSafe(rule)),
        // Mixed operations
        manager.listAvailableDomains(),
        manager.getRuleContentSafe('rule3'),
        manager.listAvailableDomains(),
      ];

      const results = await Promise.all(concurrentOperations);

      // Verify all operations completed successfully
      expect(results).toHaveLength(concurrentOperations.length);

      // Verify list operations returned correct count
      const listResults = results.slice(0, 3) as any[];
      listResults.forEach(domains => {
        expect(domains).toHaveLength(5);
      });

      // Verify get operations returned correct content
      const getResults = results.slice(3, 6) as any[];
      getResults.forEach(ruleContent => {
        expect(ruleContent?.domain).toBe('rule1');
      });

      // Verify cache is populated correctly
      const cacheStats = manager.getCacheStats();
      expect(cacheStats.size).toBe(5); // All rules should be cached
      expect(cacheStats.domains.sort()).toEqual(ruleFiles.sort());
    });
  });

  describe('Error handling integration', () => {
    it('should gracefully handle file system errors', async () => {
      const manager = new RuleManager(testRulesDir);

      // Create a valid file first
      await fs.writeFile(path.join(testRulesDir, 'valid.md'), '# Valid Rule\n\nContent here.');

      // Verify it works
      let domains = await manager.listAvailableDomains();
      expect(domains).toHaveLength(1);

      // Create a file with permission issues (simulate by creating a directory with the same name)
      await fs.mkdir(path.join(testRulesDir, 'permission-test.md'), { recursive: true });

      // Mock console to avoid noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should continue working despite the problematic file
      domains = await manager.listAvailableDomains();
      expect(domains).toHaveLength(1); // Only the valid file should be included
      expect(domains[0].domain).toBe('valid');

      // Cleanup the directory
      await fs.rm(path.join(testRulesDir, 'permission-test.md'), { recursive: true, force: true });

      consoleSpy.mockRestore();
    });

    it('should handle corrupted files gracefully', async () => {
      const manager = new RuleManager(testRulesDir);

      // Create valid files
      await fs.writeFile(path.join(testRulesDir, 'good1.md'), '# Good Rule 1\n\nContent here.');
      await fs.writeFile(path.join(testRulesDir, 'good2.md'), '# Good Rule 2\n\nContent here.');

      // Create files that might cause parsing issues
      await fs.writeFile(path.join(testRulesDir, 'binary.md'), Buffer.from([0x00, 0x01, 0x02, 0x03]));
      await fs.writeFile(path.join(testRulesDir, 'huge.md'), 'x'.repeat(10000)); // Very large file

      // Mock console to avoid noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const domains = await manager.listAvailableDomains();

      // Should include all files that can be processed
      expect(domains.length).toBeGreaterThanOrEqual(2);
      
      const domainNames = domains.map(d => d.domain);
      expect(domainNames).toContain('good1');
      expect(domainNames).toContain('good2');

      // Should be able to retrieve content for valid files
      const good1 = await manager.getRuleContent('good1');
      expect(good1).not.toBeNull();
      expect(good1?.domain).toBe('good1');

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should handle non-existent directory gracefully', async () => {
      const nonExistentDir = './non-existent-rules-dir';
      const manager = new RuleManager(nonExistentDir);

      // Should not throw errors
      const domains = await manager.listAvailableDomains();
      expect(domains).toEqual([]);

      const ruleContent = await manager.getRuleContent('any-domain');
      expect(ruleContent).toBeNull();
    });
  });

  describe('Performance and scalability', () => {
    it('should handle many rule files efficiently', async () => {
      const manager = new RuleManager(testRulesDir);
      const numFiles = 50;

      // Create many rule files
      const createPromises = Array.from({ length: numFiles }, async (_, i) => {
        const content = `# Rule ${i}

- Description: Rule number ${i}
- Version: 1.${i}

Content for rule ${i}.`;
        
        await fs.writeFile(path.join(testRulesDir, `rule${i}.md`), content);
      });

      await Promise.all(createPromises);

      // Measure performance of listing domains
      const startTime = Date.now();
      const domains = await manager.listAvailableDomains();
      const listTime = Date.now() - startTime;

      expect(domains).toHaveLength(numFiles);
      expect(listTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Measure performance of getting multiple rules
      const getStartTime = Date.now();
      const getPromises = Array.from({ length: 10 }, (_, i) => 
        manager.getRuleContent(`rule${i}`)
      );
      await Promise.all(getPromises);
      const getTime = Date.now() - getStartTime;

      expect(getTime).toBeLessThan(1000); // Should complete within 1 second

      // Verify caching is working
      const cacheStats = manager.getCacheStats();
      expect(cacheStats.size).toBe(numFiles); // All files should be cached after listing
    });

    it('should handle cache management efficiently', async () => {
      const manager = new RuleManager(testRulesDir);

      // Create test files
      await fs.writeFile(path.join(testRulesDir, 'cache1.md'), '# Cache Test 1\n\nContent 1.');
      await fs.writeFile(path.join(testRulesDir, 'cache2.md'), '# Cache Test 2\n\nContent 2.');
      await fs.writeFile(path.join(testRulesDir, 'cache3.md'), '# Cache Test 3\n\nContent 3.');

      // Load all into cache
      await manager.getRuleContent('cache1');
      await manager.getRuleContent('cache2');
      await manager.getRuleContent('cache3');

      expect(manager.getCacheStats().size).toBe(3);

      // Test selective cache clearing
      manager.clearCache('cache2');
      expect(manager.getCacheStats().size).toBe(2);
      expect(manager.getCacheStats().domains).toContain('cache1');
      expect(manager.getCacheStats().domains).toContain('cache3');
      expect(manager.getCacheStats().domains).not.toContain('cache2');

      // Test full cache clearing
      manager.clearCache();
      expect(manager.getCacheStats().size).toBe(0);
      expect(manager.getCacheStats().domains).toEqual([]);

      // Verify cache is rebuilt on access
      await manager.getRuleContent('cache1');
      expect(manager.getCacheStats().size).toBe(1);
      expect(manager.getCacheStats().domains).toContain('cache1');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical development workflow', async () => {
      const manager = new RuleManager(testRulesDir);

      // Scenario: Developer starts with some existing rules
      await fs.writeFile(path.join(testRulesDir, 'react.md'), `# React Rules

- Description: React development guidelines
- Version: 1.0

## Components
- Use functional components
- Keep components small`);

      await fs.writeFile(path.join(testRulesDir, 'testing.md'), `# Testing Rules

- Description: Testing best practices
- Version: 1.0

## Unit Tests
- Write tests first
- Test behavior, not implementation`);

      // Initial state
      let domains = await manager.listAvailableDomains();
      expect(domains).toHaveLength(2);

      // Developer adds a new rule
      await fs.writeFile(path.join(testRulesDir, 'security.md'), `# Security Rules

- Description: Security guidelines
- Version: 1.0

## Authentication
- Use strong passwords
- Implement 2FA`);

      // Clear cache to simulate fresh discovery
      manager.clearCache();
      domains = await manager.listAvailableDomains();
      expect(domains).toHaveLength(3);

      // Developer updates an existing rule
      const updatedReactContent = `# React Rules

- Description: React development guidelines
- Version: 2.0
- Last Updated: 2025-08-27

## Components
- Use functional components
- Keep components small
- Use TypeScript for better type safety

## Hooks
- Use custom hooks for reusable logic
- Follow hooks rules`;

      await fs.writeFile(path.join(testRulesDir, 'react.md'), updatedReactContent);

      // Clear cache to get updated content
      manager.clearCache('react');
      const updatedReact = await manager.getRuleContent('react');
      expect(updatedReact?.version).toBe('2.0');
      expect(updatedReact?.lastUpdated).toBe('2025-08-27');
      expect(updatedReact?.content).toContain('TypeScript');

      // Developer removes a rule
      await fs.unlink(path.join(testRulesDir, 'testing.md'));
      manager.clearCache();
      
      domains = await manager.listAvailableDomains();
      expect(domains).toHaveLength(2);
      expect(domains.map(d => d.domain)).toContain('react');
      expect(domains.map(d => d.domain)).toContain('security');
      expect(domains.map(d => d.domain)).not.toContain('testing');

      // Verify removed rule is no longer accessible
      const removedRule = await manager.getRuleContent('testing');
      expect(removedRule).toBeNull();
    });

    it('should handle team collaboration scenario', async () => {
      const manager = new RuleManager(testRulesDir);

      // Team member 1 adds frontend rules
      await fs.writeFile(path.join(testRulesDir, 'frontend.md'), `# Frontend Rules

- Description: Frontend development standards
- Version: 1.0

## CSS
- Use CSS modules
- Follow BEM naming`);

      // Team member 2 adds backend rules
      await fs.writeFile(path.join(testRulesDir, 'backend.md'), `# Backend Rules

- Description: Backend development standards
- Version: 1.0

## API Design
- Use RESTful conventions
- Version your APIs`);

      // Team member 3 adds database rules
      await fs.writeFile(path.join(testRulesDir, 'database.md'), `# Database Rules

- Description: Database design standards
- Version: 1.0

## Schema Design
- Normalize data appropriately
- Use meaningful table names`);

      // Simulate different team members accessing different rules concurrently
      const concurrentAccess = await Promise.all([
        manager.getRuleContent('frontend'),
        manager.getRuleContent('backend'),
        manager.getRuleContent('database'),
        manager.listAvailableDomains(),
      ]);

      expect(concurrentAccess[0]?.domain).toBe('frontend');
      expect(concurrentAccess[1]?.domain).toBe('backend');
      expect(concurrentAccess[2]?.domain).toBe('database');
      expect(concurrentAccess[3]).toHaveLength(3);

      // Team lead reviews all available rules
      const allDomains = await manager.listAvailableDomains();
      expect(allDomains).toHaveLength(3);
      
      const descriptions = allDomains.map(d => d.description);
      expect(descriptions).toContain('Frontend development standards');
      expect(descriptions).toContain('Backend development standards');
      expect(descriptions).toContain('Database design standards');
    });
  });
});