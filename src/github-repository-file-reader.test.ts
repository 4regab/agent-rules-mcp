import { describe, it, expect } from 'vitest';
import { GitHubRepositoryFileReader } from './github-repository-file-reader.js';

describe('GitHubRepositoryFileReader', () => {
    describe('isRuleFile', () => {
        it('should accept .md files', () => {
            const reader = new GitHubRepositoryFileReader('test', 'test', 'rules', 'main');

            // Use reflection to access private method for testing
            const isRuleFile = (reader as any).isRuleFile.bind(reader);

            expect(isRuleFile('react.md')).toBe(true);
            expect(isRuleFile('typescript.md')).toBe(true);
            expect(isRuleFile('security.md')).toBe(true);
        });

        it('should accept .mdc files', () => {
            const reader = new GitHubRepositoryFileReader('test', 'test', 'rules', 'main');

            // Use reflection to access private method for testing
            const isRuleFile = (reader as any).isRuleFile.bind(reader);

            expect(isRuleFile('react.mdc')).toBe(true);
            expect(isRuleFile('typescript.mdc')).toBe(true);
            expect(isRuleFile('test-mdc.mdc')).toBe(true);
        });

        it('should accept special rule extensions', () => {
            const reader = new GitHubRepositoryFileReader('test', 'test', 'rules', 'main');

            // Use reflection to access private method for testing
            const isRuleFile = (reader as any).isRuleFile.bind(reader);

            expect(isRuleFile('mode.chatmode.md')).toBe(true);
            expect(isRuleFile('template.prompt.md')).toBe(true);
            expect(isRuleFile('guide.instructions.md')).toBe(true);
        });

        it('should reject README and other skip files', () => {
            const reader = new GitHubRepositoryFileReader('test', 'test', 'rules', 'main');

            // Use reflection to access private method for testing
            const isRuleFile = (reader as any).isRuleFile.bind(reader);

            expect(isRuleFile('README.md')).toBe(false);
            expect(isRuleFile('CONTRIBUTING.md')).toBe(false);
            expect(isRuleFile('LICENSE.md')).toBe(false);
        });

        it('should reject non-rule files', () => {
            const reader = new GitHubRepositoryFileReader('test', 'test', 'rules', 'main');

            // Use reflection to access private method for testing
            const isRuleFile = (reader as any).isRuleFile.bind(reader);

            expect(isRuleFile('package.json')).toBe(false);
            expect(isRuleFile('script.js')).toBe(false);
            expect(isRuleFile('style.css')).toBe(false);
            expect(isRuleFile('image.png')).toBe(false);
        });
    });

    describe('extractDomainFromFilename', () => {
        it('should extract domain from .md files', () => {
            const reader = new GitHubRepositoryFileReader('test', 'test', 'rules', 'main');

            // Use reflection to access private method for testing
            const extractDomain = (reader as any).extractDomainFromFilename.bind(reader);

            expect(extractDomain('react.md')).toBe('react');
            expect(extractDomain('typescript.md')).toBe('typescript');
            expect(extractDomain('node-express.md')).toBe('node-express');
        });

        it('should extract domain from .mdc files', () => {
            const reader = new GitHubRepositoryFileReader('test', 'test', 'rules', 'main');

            // Use reflection to access private method for testing
            const extractDomain = (reader as any).extractDomainFromFilename.bind(reader);

            expect(extractDomain('react.mdc')).toBe('react');
            expect(extractDomain('typescript.mdc')).toBe('typescript');
            expect(extractDomain('test-mdc.mdc')).toBe('test-mdc');
        });

        it('should extract domain from special rule extensions', () => {
            const reader = new GitHubRepositoryFileReader('test', 'test', 'rules', 'main');

            // Use reflection to access private method for testing
            const extractDomain = (reader as any).extractDomainFromFilename.bind(reader);

            expect(extractDomain('mode.chatmode.md')).toBe('mode');
            expect(extractDomain('template.prompt.md')).toBe('template');
            expect(extractDomain('guide.instructions.md')).toBe('guide');
        });
    });

    describe('extractDomainsFromDirectoryData', () => {
        it('should extract domains from mixed file types including .mdc', () => {
            const reader = new GitHubRepositoryFileReader('test', 'test', 'rules', 'main');

            // Use reflection to access private method for testing
            const extractDomains = (reader as any).extractDomainsFromDirectoryData.bind(reader);

            const mockData = [
                { type: 'file', name: 'react.md' },
                { type: 'file', name: 'typescript.md' },
                { type: 'file', name: 'test-mdc.mdc' },
                { type: 'file', name: 'security.md' },
                { type: 'file', name: 'README.md' }, // Should be filtered out
                { type: 'directory', name: 'subfolder' }, // Should be filtered out
                { type: 'file', name: 'package.json' } // Should be filtered out
            ];

            const domains = extractDomains(mockData);

            expect(domains).toContain('react');
            expect(domains).toContain('typescript');
            expect(domains).toContain('test-mdc'); // This is the key test for .mdc support
            expect(domains).toContain('security');
            expect(domains).not.toContain('README');
            expect(domains).not.toContain('subfolder');
            expect(domains).not.toContain('package');

            expect(domains.length).toBe(4);
        });

        it('should handle duplicate domains from different file types', () => {
            const reader = new GitHubRepositoryFileReader('test', 'test', 'rules', 'main');

            // Use reflection to access private method for testing
            const extractDomains = (reader as any).extractDomainsFromDirectoryData.bind(reader);

            const mockData = [
                { type: 'file', name: 'react.md' },
                { type: 'file', name: 'react.mdc' }, // Same domain, different extension
                { type: 'file', name: 'typescript.md' }
            ];

            const domains = extractDomains(mockData);

            expect(domains).toContain('react');
            expect(domains).toContain('typescript');
            expect(domains.length).toBe(2); // Should deduplicate
        });
    });
});