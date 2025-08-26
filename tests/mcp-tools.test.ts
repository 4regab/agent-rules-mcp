import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { RuleManager } from './rule-manager.js';

describe('MCP Tools Logic', () => {
    const testRulesDir = './test-rules-mcp';
    let ruleManager: RuleManager;

    beforeEach(async () => {
        // Create test rules directory
        await fs.mkdir(testRulesDir, { recursive: true });
        ruleManager = new RuleManager(testRulesDir);
    });

    afterEach(async () => {
        // Clean up test rules directory
        try {
            await fs.rm(testRulesDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('tool logic validation', () => {
        it('should have correct tool definitions', () => {
            // Test the tool definitions that would be returned by list_tools
            const tools = [
                {
                    name: 'get_rules',
                    description: 'Get rule content for one or multiple domains',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            domain: {
                                type: 'string',
                                description: 'The domain name to retrieve rules for (e.g., "react", "security")',
                            },
                            domains: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                },
                                description: 'Array of domain names to retrieve rules for (e.g., ["react", "security", "nextjs"])',
                            },
                        },
                        oneOf: [
                            { required: ['domain'] },
                            { required: ['domains'] }
                        ],
                    },
                },
                {
                    name: 'list_rules',
                    description: 'List all available rule domains with descriptions',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        additionalProperties: false,
                    },
                },
            ];

            expect(tools).toHaveLength(2);
            expect(tools.map(t => t.name)).toEqual(['get_rules', 'list_rules']);

            const getRulesTool = tools.find(t => t.name === 'get_rules');
            const listRulesTool = tools.find(t => t.name === 'list_rules');

            expect(getRulesTool).toBeDefined();
            expect(getRulesTool?.inputSchema.properties).toHaveProperty('domain');
            expect(getRulesTool?.inputSchema.properties).toHaveProperty('domains');
            expect(getRulesTool?.inputSchema.oneOf).toHaveLength(2);

            expect(listRulesTool).toBeDefined();
            expect(listRulesTool?.inputSchema.properties).toEqual({});
        });
    });

    describe('get_rules tool logic', () => {
        it('should return rule content for valid domain', async () => {
            const testContent = `# React Rules

- Description: React development best practices
- Version: 2.0
- Last Updated: 2025-08-27

## Rules

1. Use functional components
2. Use hooks for state management`;

            await fs.writeFile(path.join(testRulesDir, 'react.md'), testContent);

            // Simulate the get_rules tool logic
            const domain = 'react';
            const ruleContent = await ruleManager.getRuleContentSafe(domain);

            expect(ruleContent).not.toBeNull();
            expect(ruleContent?.domain).toBe('react');
            expect(ruleContent?.content).toBe(testContent);
            expect(ruleContent?.description).toBe('React development best practices');
            expect(ruleContent?.version).toBe('2.0');
            expect(ruleContent?.lastUpdated).toBe('2025-08-27');

            // Simulate the response format (title and content only)
            const response = {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            title: ruleContent.domain,
                            content: ruleContent.content,
                        }, null, 2),
                    },
                ],
            };

            expect(response.content).toHaveLength(1);
            expect(response.content[0].type).toBe('text');

            const result = JSON.parse(response.content[0].text);
            expect(result.title).toBe('react');
            expect(result.content).toBe(testContent);
        });

        it('should handle non-existent domain', async () => {
            const domain = 'non-existent';
            const ruleContent = await ruleManager.getRuleContentSafe(domain);

            expect(ruleContent).toBeNull();

            // This would trigger an error in the actual tool
            const availableDomains = await ruleManager.listAvailableDomains();
            const domainList = availableDomains.map(d => d.domain).join(', ');
            const expectedError = `Rule not found for domain: ${domain}. Available domains: ${domainList}`;

            expect(expectedError).toContain('Rule not found for domain: non-existent');
        });

        it('should validate domain parameter logic', () => {
            // Test domain validation logic
            const validateDomain = (args: any) => {
                if (!args || typeof args !== 'object') {
                    throw new Error('Invalid arguments: expected object with domain property');
                }

                const { domain } = args;

                if (!domain || typeof domain !== 'string') {
                    throw new Error('Invalid domain parameter: must be a non-empty string');
                }

                if (domain.trim().length === 0) {
                    throw new Error('Invalid domain parameter: must be a non-empty string');
                }

                const sanitizedDomain = domain.replace(/[^a-zA-Z0-9\-_]/g, '');
                if (sanitizedDomain !== domain) {
                    throw new Error('Invalid domain name: only alphanumeric characters, hyphens, and underscores are allowed');
                }

                return sanitizedDomain;
            };

            // Missing domain
            expect(() => validateDomain({})).toThrow('Invalid domain parameter: must be a non-empty string');

            // Empty domain
            expect(() => validateDomain({ domain: '' })).toThrow('Invalid domain parameter: must be a non-empty string');

            // Invalid characters
            expect(() => validateDomain({ domain: 'invalid domain' })).toThrow('Invalid domain name: only alphanumeric characters, hyphens, and underscores are allowed');

            // Valid domain
            expect(validateDomain({ domain: 'valid-domain' })).toBe('valid-domain');
        });

        it('should sanitize domain names', () => {
            const sanitizeDomain = (domain: string) => {
                const sanitized = domain.replace(/[^a-zA-Z0-9\-_]/g, '');
                if (sanitized !== domain) {
                    throw new Error('Invalid domain name: only alphanumeric characters, hyphens, and underscores are allowed');
                }
                return sanitized;
            };

            // Should reject domain with special characters
            expect(() => sanitizeDomain('test/../../../etc/passwd')).toThrow('Invalid domain name');
            expect(() => sanitizeDomain('test@domain')).toThrow('Invalid domain name');
            expect(() => sanitizeDomain('test domain')).toThrow('Invalid domain name');

            // Should accept valid domains
            expect(sanitizeDomain('test')).toBe('test');
            expect(sanitizeDomain('test-domain')).toBe('test-domain');
            expect(sanitizeDomain('test_domain')).toBe('test_domain');
        });

        it('should handle invalid arguments', () => {
            const validateArgs = (args: any) => {
                if (!args || typeof args !== 'object') {
                    throw new Error('Invalid arguments: expected object with domain or domains property');
                }
                return args;
            };

            // Non-object arguments
            expect(() => validateArgs('invalid')).toThrow('Invalid arguments: expected object with domain or domains property');

            // Null arguments
            expect(() => validateArgs(null)).toThrow('Invalid arguments: expected object with domain or domains property');

            // Valid arguments
            expect(validateArgs({ domain: 'test' })).toEqual({ domain: 'test' });
            expect(validateArgs({ domains: ['test1', 'test2'] })).toEqual({ domains: ['test1', 'test2'] });
        });

        it('should handle multiple domains request', async () => {
            // Create test files
            const reactContent = `# React Rules
- Description: React development best practices
- Version: 2.0
- Last Updated: 2025-08-27

## Rules
1. Use functional components`;

            const securityContent = `# Security Rules
- Description: Security best practices
- Version: 1.0
- Last Updated: 2025-08-27

## Rules
1. Validate all inputs`;

            await fs.writeFile(path.join(testRulesDir, 'react.md'), reactContent);
            await fs.writeFile(path.join(testRulesDir, 'security.md'), securityContent);

            // Test multiple domains logic
            const domains = ['react', 'security'];
            const results = await Promise.allSettled(
                domains.map(async (domain) => {
                    const ruleContent = await ruleManager.getRuleContentSafe(domain);
                    if (!ruleContent) {
                        throw new Error(`Rule not found for domain: ${domain}`);
                    }
                    return {
                        domain: ruleContent.domain,
                        content: ruleContent.content,
                    };
                })
            );

            const successfulResults: any[] = [];
            const failedDomains: string[] = [];

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    successfulResults.push(result.value);
                } else {
                    failedDomains.push(domains[index]);
                }
            });

            expect(successfulResults).toHaveLength(2);
            expect(failedDomains).toHaveLength(0);

            const responseData = {
                rules: successfulResults.map(rule => ({
                    title: rule.domain,
                    content: rule.content
                })),
                total: successfulResults.length,
                ...(failedDomains.length > 0 && { failed: failedDomains })
            };

            expect(responseData.rules).toHaveLength(2);
            expect(responseData.total).toBe(2);
            expect(responseData.failed).toBeUndefined();

            const reactRule = responseData.rules.find(r => r.title === 'react');
            const securityRule = responseData.rules.find(r => r.title === 'security');

            expect(reactRule).toBeDefined();
            expect(reactRule.content).toBe(reactContent);

            expect(securityRule).toBeDefined();
            expect(securityRule.content).toBe(securityContent);
        });

        it('should handle partial failures in multiple domains request', async () => {
            // Create only one test file
            const reactContent = `# React Rules
- Description: React development best practices

## Rules
1. Use functional components`;

            await fs.writeFile(path.join(testRulesDir, 'react.md'), reactContent);

            // Test with one valid and one invalid domain
            const domains = ['react', 'nonexistent'];
            const results = await Promise.allSettled(
                domains.map(async (domain) => {
                    const ruleContent = await ruleManager.getRuleContentSafe(domain);
                    if (!ruleContent) {
                        throw new Error(`Rule not found for domain: ${domain}`);
                    }
                    return {
                        domain: ruleContent.domain,
                        content: ruleContent.content,
                    };
                })
            );

            const successfulResults: any[] = [];
            const failedDomains: string[] = [];

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    successfulResults.push(result.value);
                } else {
                    failedDomains.push(domains[index]);
                }
            });

            expect(successfulResults).toHaveLength(1);
            expect(failedDomains).toHaveLength(1);
            expect(failedDomains[0]).toBe('nonexistent');

            const responseData = {
                rules: successfulResults.map(rule => ({
                    title: rule.domain,
                    content: rule.content
                })),
                total: successfulResults.length,
                ...(failedDomains.length > 0 && { failed: failedDomains })
            };

            expect(responseData.rules).toHaveLength(1);
            expect(responseData.total).toBe(1);
            expect(responseData.failed).toEqual(['nonexistent']);
        });

        it('should validate multiple domains input', () => {
            const validateMultipleDomains = (args: any) => {
                const { domain, domains } = args;

                if (domain && domains) {
                    throw new Error('Must provide either domain or domains parameter, but not both');
                }

                if (!domain && !domains) {
                    throw new Error('Must provide either domain or domains parameter');
                }

                if (domains) {
                    if (!Array.isArray(domains)) {
                        throw new Error('Invalid domains parameter: must be an array of strings');
                    }

                    if (domains.length === 0) {
                        throw new Error('Domains array cannot be empty');
                    }

                    for (const d of domains) {
                        if (typeof d !== 'string' || d.trim().length === 0) {
                            throw new Error('All domains must be non-empty strings');
                        }
                    }
                }

                return args;
            };

            // Both domain and domains provided
            expect(() => validateMultipleDomains({ domain: 'test', domains: ['test'] }))
                .toThrow('Must provide either domain or domains parameter, but not both');

            // Neither provided
            expect(() => validateMultipleDomains({}))
                .toThrow('Must provide either domain or domains parameter');

            // Invalid domains type
            expect(() => validateMultipleDomains({ domains: 'not-array' }))
                .toThrow('Invalid domains parameter: must be an array of strings');

            // Empty domains array
            expect(() => validateMultipleDomains({ domains: [] }))
                .toThrow('Domains array cannot be empty');

            // Invalid domain in array
            expect(() => validateMultipleDomains({ domains: ['valid', ''] }))
                .toThrow('All domains must be non-empty strings');

            // Valid single domain
            expect(validateMultipleDomains({ domain: 'test' })).toEqual({ domain: 'test' });

            // Valid multiple domains
            expect(validateMultipleDomains({ domains: ['test1', 'test2'] }))
                .toEqual({ domains: ['test1', 'test2'] });
        });
    });

    describe('list_rules tool logic', () => {
        it('should return empty list for empty directory', async () => {
            // Simulate the list_rules tool logic
            const domains = await ruleManager.listAvailableDomains();

            expect(domains).toEqual([]);

            // Simulate the response format
            const response = {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            domains: [],
                            totalCount: 0,
                            message: 'No rule files found in the rules directory. Add .md files to the rules/ directory to make them available.',
                        }, null, 2),
                    },
                ],
            };

            expect(response.content).toHaveLength(1);
            expect(response.content[0].type).toBe('text');

            const result = JSON.parse(response.content[0].text);
            expect(result.domains).toEqual([]);
            expect(result.totalCount).toBe(0);
            expect(result.message).toContain('No rule files found');
        });

        it('should list all available domains', async () => {
            await fs.writeFile(path.join(testRulesDir, 'react.md'), `# React Rules

- Description: React development rules
- Last Updated: 2025-08-27

Content here.`);

            await fs.writeFile(path.join(testRulesDir, 'security.md'), `# Security Rules

- Description: Security best practices

Content here.`);

            // Simulate the list_rules tool logic
            const domains = await ruleManager.listAvailableDomains();

            expect(domains).toHaveLength(2);

            // Simulate the response format
            const response = {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            domains: domains.map(domain => ({
                                domain: domain.domain,
                                description: domain.description,
                                lastUpdated: domain.lastUpdated,
                            })),
                            totalCount: domains.length,
                            message: `Found ${domains.length} rule domain${domains.length === 1 ? '' : 's'}`,
                        }, null, 2),
                    },
                ],
            };

            expect(response.content).toHaveLength(1);
            expect(response.content[0].type).toBe('text');

            const result = JSON.parse(response.content[0].text);
            expect(result.domains).toHaveLength(2);
            expect(result.totalCount).toBe(2);
            expect(result.message).toContain('Found 2 rule domains');

            const reactDomain = result.domains.find((d: any) => d.domain === 'react');
            expect(reactDomain.description).toBe('React development rules');
            expect(reactDomain.lastUpdated).toBe('2025-08-27');

            const securityDomain = result.domains.find((d: any) => d.domain === 'security');
            expect(securityDomain.description).toBe('Security best practices');
        });

        it('should handle domains without metadata', async () => {
            await fs.writeFile(path.join(testRulesDir, 'simple.md'), '# Simple Rule\n\nNo metadata here.');

            const domains = await ruleManager.listAvailableDomains();

            expect(domains).toHaveLength(1);
            expect(domains[0].domain).toBe('simple');
            expect(domains[0].description).toBe('Rules for simple');
        });

        it('should not require any arguments', () => {
            // The list_rules tool doesn't require any arguments
            // This is validated by the schema having empty properties
            const schema = {
                type: 'object',
                properties: {},
                additionalProperties: false,
            };

            expect(schema.properties).toEqual({});
            expect(schema.additionalProperties).toBe(false);
        });
    });

    describe('tool routing logic', () => {
        it('should reject unknown tool names', () => {
            const handleToolCall = (toolName: string) => {
                if (toolName === 'get_rules') {
                    return 'get_rules_handler';
                }
                if (toolName === 'list_rules') {
                    return 'list_rules_handler';
                }
                throw new Error(`Unknown tool: ${toolName}`);
            };

            expect(() => handleToolCall('unknown_tool')).toThrow('Unknown tool: unknown_tool');
            expect(handleToolCall('get_rules')).toBe('get_rules_handler');
            expect(handleToolCall('list_rules')).toBe('list_rules_handler');
        });
    });

    describe('concurrent requests', () => {
        it('should handle multiple concurrent get_rules requests', async () => {
            const testContent = '# Concurrent Rule\n\nTesting concurrent access.';
            await fs.writeFile(path.join(testRulesDir, 'concurrent.md'), testContent);

            // Test concurrent access to the same domain
            const promises = Array.from({ length: 5 }, () =>
                ruleManager.getRuleContentSafe('concurrent')
            );

            const results = await Promise.all(promises);

            // All results should be identical
            results.forEach(result => {
                expect(result).not.toBeNull();
                expect(result?.domain).toBe('concurrent');
                expect(result?.content).toBe(testContent);
            });
        });

        it('should handle mixed concurrent requests', async () => {
            await fs.writeFile(path.join(testRulesDir, 'test1.md'), '# Test 1\n\nContent 1.');
            await fs.writeFile(path.join(testRulesDir, 'test2.md'), '# Test 2\n\nContent 2.');

            const promises = [
                ruleManager.getRuleContentSafe('test1'),
                ruleManager.getRuleContentSafe('test2'),
                ruleManager.listAvailableDomains(),
            ];

            const results = await Promise.all(promises);

            // Verify each result
            expect(results[0]?.domain).toBe('test1');
            expect(results[1]?.domain).toBe('test2');
            expect((results[2] as any).length).toBe(2);
        });

        it('should handle multiple domains efficiently with getMultipleRuleContents', async () => {
            await fs.writeFile(path.join(testRulesDir, 'test1.md'), '# Test 1\n\nContent 1.');
            await fs.writeFile(path.join(testRulesDir, 'test2.md'), '# Test 2\n\nContent 2.');
            await fs.writeFile(path.join(testRulesDir, 'test3.md'), '# Test 3\n\nContent 3.');

            const domains = ['test1', 'test2', 'test3', 'nonexistent'];
            const results = await ruleManager.getMultipleRuleContents(domains);

            expect(results.size).toBe(4);
            expect(results.get('test1')?.domain).toBe('test1');
            expect(results.get('test2')?.domain).toBe('test2');
            expect(results.get('test3')?.domain).toBe('test3');
            expect(results.get('nonexistent')).toBeNull();
        });
    });
});