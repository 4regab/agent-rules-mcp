import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { RepositoryFileReader } from './repository-file-reader.js';

describe('RepositoryFileReader', () => {
  const testRulesDir = './test-rules';
  let reader: RepositoryFileReader;

  beforeEach(async () => {
    // Create test rules directory
    await fs.mkdir(testRulesDir, { recursive: true });
    reader = new RepositoryFileReader(testRulesDir);
  });

  afterEach(async () => {
    // Clean up test rules directory
    try {
      await fs.rm(testRulesDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('readRuleFile', () => {
    it('should read an existing rule file', async () => {
      const testContent = '# Test Rule\n\nThis is a test rule.';
      await fs.writeFile(path.join(testRulesDir, 'test.md'), testContent);

      const content = await reader.readRuleFile('test');
      expect(content).toBe(testContent);
    });

    it('should throw error for non-existent file', async () => {
      await expect(reader.readRuleFile('non-existent')).rejects.toThrow('Rule file not found for domain: non-existent');
    });

    it('should handle permission errors gracefully', async () => {
      // This test is platform-specific and may not work on all systems
      // We'll test the error handling logic instead
      const invalidPath = '/invalid/path/that/does/not/exist';
      const invalidReader = new RepositoryFileReader(invalidPath);
      
      await expect(invalidReader.readRuleFile('test')).rejects.toThrow();
    });
  });

  describe('listRuleFiles', () => {
    it('should return empty array for empty directory', async () => {
      const files = await reader.listRuleFiles();
      expect(files).toEqual([]);
    });

    it('should list all .md files without extension', async () => {
      await fs.writeFile(path.join(testRulesDir, 'rule1.md'), '# Rule 1');
      await fs.writeFile(path.join(testRulesDir, 'rule2.md'), '# Rule 2');
      await fs.writeFile(path.join(testRulesDir, 'not-a-rule.txt'), 'Not a rule');

      const files = await reader.listRuleFiles();
      expect(files).toEqual(expect.arrayContaining(['rule1', 'rule2']));
      expect(files).not.toContain('not-a-rule');
      expect(files).toHaveLength(2);
    });

    it('should return empty array for non-existent directory', async () => {
      const nonExistentReader = new RepositoryFileReader('./non-existent-dir');
      const files = await nonExistentReader.listRuleFiles();
      expect(files).toEqual([]);
    });
  });

  describe('ruleExists', () => {
    it('should return true for existing rule file', async () => {
      await fs.writeFile(path.join(testRulesDir, 'existing.md'), '# Existing Rule');

      const exists = await reader.ruleExists('existing');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent rule file', async () => {
      const exists = await reader.ruleExists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('parseRuleContent', () => {
    it('should parse content with metadata', () => {
      const content = `# Test Rule

- Last Updated: 2025-08-27
- Description: A test rule for testing
- Version: 1.0

## Content

This is the rule content.`;

      const parsed = reader.parseRuleContent(content, 'test');
      
      expect(parsed.domain).toBe('test');
      expect(parsed.description).toBe('A test rule for testing');
      expect(parsed.lastUpdated).toBe('2025-08-27');
      expect(parsed.version).toBe('1.0');
      expect(parsed.content).toBe(content);
    });

    it('should handle content without metadata', () => {
      const content = `# Test Rule

This is a simple rule without metadata.`;

      const parsed = reader.parseRuleContent(content, 'simple');
      
      expect(parsed.domain).toBe('simple');
      expect(parsed.description).toBeUndefined();
      expect(parsed.lastUpdated).toBeUndefined();
      expect(parsed.version).toBeUndefined();
      expect(parsed.content).toBe(content);
    });

    it('should handle Windows line endings', () => {
      const content = `# Test Rule\r\n\r\n- Description: Windows line endings test\r\n- Version: 1.0\r\n\r\nContent here.`;

      const parsed = reader.parseRuleContent(content, 'windows');
      
      expect(parsed.description).toBe('Windows line endings test');
      expect(parsed.version).toBe('1.0');
    });

    it('should handle mixed metadata formats', () => {
      const content = `# Test Rule

- Description: Mixed format test
Version: 2.0
- Last Updated: 2025-08-27

Content here.`;

      const parsed = reader.parseRuleContent(content, 'mixed');
      
      expect(parsed.description).toBe('Mixed format test');
      expect(parsed.lastUpdated).toBe('2025-08-27');
      // Version without dash should not be parsed
      expect(parsed.version).toBeUndefined();
    });
  });

  describe('parseRuleContent - Enhanced Functionality', () => {
    it('should parse YAML frontmatter', () => {
      const content = `---
description: YAML frontmatter test
last_updated: 2025-08-27
version: 2.0
---

# Test Rule

This is the main content.`;

      const parsed = reader.parseRuleContent(content, 'yaml-test');
      
      expect(parsed.domain).toBe('yaml-test');
      expect(parsed.description).toBe('YAML frontmatter test');
      expect(parsed.lastUpdated).toBe('2025-08-27');
      expect(parsed.version).toBe('2.0');
      expect(parsed.content).toBe('# Test Rule\n\nThis is the main content.');
    });

    it('should handle invalid YAML frontmatter gracefully', () => {
      const content = `---
description: This YAML frontmatter has syntax errors
version: 2.0
invalid_yaml: [unclosed array
missing_quotes: this should be quoted
---

# Invalid YAML Test

Content here.`;

      const parsed = reader.parseRuleContent(content, 'invalid-yaml');
      
      expect(parsed.domain).toBe('invalid-yaml');
      expect(parsed.content).toContain('Invalid YAML Test');
      // The description should either be parsed correctly or contain an error message
      expect(parsed.description).toBeDefined();
    });

    it('should handle frontmatter with quoted values', () => {
      const content = `---
description: "Quoted description value"
version: '1.5'
last_updated: "2025-08-27"
---

# Content`;

      const parsed = reader.parseRuleContent(content, 'quoted');
      
      expect(parsed.description).toBe('Quoted description value');
      expect(parsed.version).toBe('1.5');
      expect(parsed.lastUpdated).toBe('2025-08-27');
    });

    it('should handle complex YAML with arrays and objects', () => {
      const content = `---
description: Complex YAML test
version: 2.0
tags: [security, authentication, encryption]
author: Security Team
metadata:
  complexity: high
  reviewed: true
---

# Complex YAML

Content here.`;

      const parsed = reader.parseRuleContent(content, 'complex');
      
      expect(parsed.description).toBe('Complex YAML test');
      expect(parsed.version).toBe('2.0');
    });

    it('should prioritize YAML frontmatter over inline metadata', () => {
      const content = `---
description: YAML description
version: 2.0
---

# Test Rule

- Description: Inline description
- Version: 1.0

Content here.`;

      const parsed = reader.parseRuleContent(content, 'priority-test');
      
      expect(parsed.description).toBe('YAML description');
      expect(parsed.version).toBe('2.0');
    });

    it('should handle empty frontmatter', () => {
      const content = `---
---

# Empty Frontmatter

Content here.`;

      const parsed = reader.parseRuleContent(content, 'empty-frontmatter');
      
      expect(parsed.domain).toBe('empty-frontmatter');
      expect(parsed.content).toContain('# Empty Frontmatter');
      expect(parsed.description).toBeUndefined();
    });

    it('should handle frontmatter without closing delimiter', () => {
      const content = `---
description: Unclosed frontmatter
version: 1.0

# Test Rule

Content here.`;

      const parsed = reader.parseRuleContent(content, 'unclosed');
      
      expect(parsed.domain).toBe('unclosed');
      expect(parsed.content).toBe(content);
      expect(parsed.description).toBeUndefined(); // Should fall back to inline parsing
    });
  });

  describe('extractDomainFromFilename', () => {
    it('should extract domain from .md filename', () => {
      expect(reader.extractDomainFromFilename('test-rule.md')).toBe('test-rule');
      expect(reader.extractDomainFromFilename('security.md')).toBe('security');
    });

    it('should handle filename without .md extension', () => {
      expect(reader.extractDomainFromFilename('test-rule')).toBe('test-rule');
    });

    it('should handle complex domain names', () => {
      expect(reader.extractDomainFromFilename('nextjs-tailwind.md')).toBe('nextjs-tailwind');
      expect(reader.extractDomainFromFilename('performance_optimization.md')).toBe('performance_optimization');
    });
  });

  describe('isValidDomain', () => {
    it('should validate correct domain names', () => {
      expect(reader.isValidDomain('test')).toBe(true);
      expect(reader.isValidDomain('test-rule')).toBe(true);
      expect(reader.isValidDomain('test_rule')).toBe(true);
      expect(reader.isValidDomain('nextjs-tailwind')).toBe(true);
      expect(reader.isValidDomain('rule123')).toBe(true);
    });

    it('should reject invalid domain names', () => {
      expect(reader.isValidDomain('')).toBe(false);
      expect(reader.isValidDomain('test rule')).toBe(false); // spaces
      expect(reader.isValidDomain('test.rule')).toBe(false); // dots
      expect(reader.isValidDomain('test/rule')).toBe(false); // slashes
      expect(reader.isValidDomain('test@rule')).toBe(false); // special chars
    });
  });

  describe('listRuleFiles - Enhanced Error Handling', () => {
    it('should skip invalid files and continue processing', async () => {
      // Create valid files
      await fs.writeFile(path.join(testRulesDir, 'valid1.md'), '# Valid Rule 1');
      await fs.writeFile(path.join(testRulesDir, 'valid2.md'), '# Valid Rule 2');
      
      // Create file with invalid domain name
      await fs.writeFile(path.join(testRulesDir, 'invalid domain.md'), '# Invalid');
      
      const files = await reader.listRuleFiles();
      
      // Should only include valid files
      expect(files).toEqual(expect.arrayContaining(['valid1', 'valid2']));
      expect(files).not.toContain('invalid domain');
      expect(files).toHaveLength(2);
    });
  });

  describe('getRulesDirectory', () => {
    it('should return the absolute path to rules directory', () => {
      const directory = reader.getRulesDirectory();
      expect(directory).toBe(path.resolve(testRulesDir));
    });
  });
});