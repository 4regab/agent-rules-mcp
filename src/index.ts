#!/usr/bin/env node

/**
 * Agent Rules MCP Server
 * 
 * A Model Context Protocol server that provides development rules and best practices
 * from a remote GitHub repository.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { RuleManager } from './rule-manager.js';
import { ErrorHandler, Logger } from './error-handler.js';

// Initialize the rule manager (now uses GitHub repository)
const ruleManager = new RuleManager();

const server = new Server(
  {
    name: 'agent-rules-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_rules',
        description: `Retrieves development rules and best practices for specific domains from GitHub repository rules folder.

Supports both .md and .mdc markdown files with flexible structure - works with any markdown content even without specific metadata.

IMPORTANT: When users request "apply all rules" or "get all rules", use the 'domains' parameter with ALL available domain names from list_rules to return every rule at once.

You MUST call 'list_rules' first to see available domains UNLESS you already know the exact domain names.

Usage Patterns:
- Single domain: {"domain": "react"} - Gets one specific rule set
- Multiple domains: {"domains": ["react", "security", "typescript"]} - Gets multiple specific rule sets  
- ALL rules: {"domains": ["domain1", "domain2", "domain3", ...]} - Gets every available rule (use ALL domain names from list_rules)

Selection Process:
1. If user says "apply all rules" or "get all rules" → Call list_rules first, then use ALL domain names in the domains array
2. For specific requests → Analyze what development domain/technology the user needs rules for
3. Return the most relevant rule content based on:
   - Exact domain name match (e.g., "react", "security", "typescript")
   - Content relevance to the user's development context
   - Comprehensive coverage of best practices and guidelines

For ambiguous requests, request clarification before proceeding with a best-guess match.`,
        inputSchema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'The domain name to retrieve rules for (e.g., "react", "security"). Use this for single domain requests.',
            },
            domains: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Array of domain names to retrieve rules for. Use ALL available domain names from list_rules when user requests "apply all rules" (e.g., ["react", "security", "nextjs", "typescript", "clean-code", ...]). Use this for multiple domain requests.',
            },
          },
        },
      },
      {
        name: 'list_rules',
        description: `Lists all available development rule domains with descriptions and metadata from the GitHub repository.

Supports both .md and .mdc markdown files with flexible metadata extraction - automatically generates descriptions even for files without explicit metadata.

This function provides a comprehensive overview of all available rule sets, helping users discover relevant development guidelines and best practices.

Discovery Process:
1. Scans the rules folder in repository for all available .md and .mdc files
2. Extracts metadata including descriptions and last updated timestamps (when available)
3. Auto-generates descriptions from content when explicit metadata is missing
4. Returns organized list with domain names matching filename conventions

Response Format:
- Returns {domains: [{domain, description, lastUpdated}], totalCount, message} object
- Each domain entry includes:
  - domain: The exact name to use with 'get_rules' (matches filename without .md/.mdc extension)
  - description: Human-readable summary of what the rules cover (extracted or auto-generated)
  - lastUpdated: When the rules were last modified (if available in metadata)

Usage:
- Call this function first to explore available rule domains
- Use the returned domain names exactly as shown when calling 'get_rules'
- Review descriptions to find the most relevant rules for your development context

No parameters required - simply call list_rules() to see all available options.`,
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'get_rules') {
      // Validate input
      if (!args || typeof args !== 'object') {
        throw ErrorHandler.createMcpError(
          ErrorCode.InvalidParams,
          'Invalid arguments: expected object with domain or domains property',
          undefined,
          ['Provide a domain parameter as a string: {"domain": "react"}', 'Or provide domains parameter as an array: {"domains": ["react", "security"]}']
        );
      }

      const { domain, domains } = args as { domain?: unknown; domains?: unknown };

      // Determine which mode we're in (single or multiple domains)
      let domainsToProcess: string[] = [];

      if (domain && !domains) {
        // Single domain mode
        if (typeof domain !== 'string') {
          throw ErrorHandler.createMcpError(
            ErrorCode.InvalidParams,
            'Invalid domain parameter: must be a non-empty string',
            undefined,
            ['Provide a domain parameter as a string', 'Example: {"domain": "react"}']
          );
        }

        if (domain.trim().length === 0) {
          throw ErrorHandler.handleDomainValidationError(domain);
        }

        domainsToProcess = [domain];
      } else if (domains && !domain) {
        // Multiple domains mode
        if (!Array.isArray(domains)) {
          throw ErrorHandler.createMcpError(
            ErrorCode.InvalidParams,
            'Invalid domains parameter: must be an array of strings',
            undefined,
            ['Provide domains parameter as an array', 'Example: {"domains": ["react", "security", "nextjs"]}']
          );
        }

        if (domains.length === 0) {
          throw ErrorHandler.createMcpError(
            ErrorCode.InvalidParams,
            'Domains array cannot be empty',
            undefined,
            ['Provide at least one domain in the array', 'Example: {"domains": ["react"]}']
          );
        }

        // Validate each domain in the array
        for (const d of domains) {
          if (typeof d !== 'string' || d.trim().length === 0) {
            throw ErrorHandler.createMcpError(
              ErrorCode.InvalidParams,
              'All domains must be non-empty strings',
              undefined,
              ['Ensure all items in domains array are valid strings', 'Example: {"domains": ["react", "security"]}']
            );
          }
        }

        domainsToProcess = domains as string[];
      } else {
        throw ErrorHandler.createMcpError(
          ErrorCode.InvalidParams,
          'Must provide either domain or domains parameter, but not both',
          undefined,
          ['For single domain: {"domain": "react"}', 'For multiple domains: {"domains": ["react", "security"]}']
        );
      }

      // Sanitize all domain names
      const sanitizedDomains = domainsToProcess.map(d => {
        const sanitized = d.replace(/[^a-zA-Z0-9\-_]/g, '');
        if (sanitized !== d) {
          throw ErrorHandler.handleDomainValidationError(d);
        }
        return sanitized;
      });

      // Get rule content for all domains
      const results = await Promise.allSettled(
        sanitizedDomains.map(async (sanitizedDomain) => {
          const ruleContent = await ruleManager.getRuleContentSafe(sanitizedDomain);
          if (!ruleContent) {
            throw new Error(`Rule not found for domain: ${sanitizedDomain}`);
          }
          return {
            domain: ruleContent.domain,
            content: ruleContent.content,
          };
        })
      );

      // Process results
      const successfulResults: any[] = [];
      const failedDomains: string[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
        } else {
          failedDomains.push(sanitizedDomains[index]);
        }
      });

      // If all domains failed, throw an error with helpful information
      if (successfulResults.length === 0) {
        const availableDomains = await ruleManager.listAvailableDomains();
        const domainList = availableDomains.map(d => d.domain).join(', ');

        throw ErrorHandler.createMcpError(
          ErrorCode.InvalidParams,
          `No rules found for any of the requested domains: ${failedDomains.join(', ')}`,
          undefined,
          [
            'Check if the domain names are spelled correctly',
            'Use list_rules to see available domains',
            `Available domains: ${domainList}`,
            'Domain names should match the filename without .md extension'
          ]
        );
      }

      // Return results with simplified format (title and content only)
      const responseData = domainsToProcess.length === 1
        ? {
          title: successfulResults[0].domain,
          content: successfulResults[0].content
        }
        : {
          rules: successfulResults.map(rule => ({
            title: rule.domain,
            content: rule.content
          })),
          total: successfulResults.length,
          ...(failedDomains.length > 0 && { failed: failedDomains })
        };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(responseData, null, 2),
          },
        ],
      };
    }

    if (name === 'list_rules') {
      // No input validation needed for list_rules as it takes no parameters

      // Get all available domains
      const domains = await ruleManager.listAvailableDomains();

      if (domains.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                domains: [],
                totalCount: 0,
                message: 'No rule files found in the GitHub repository.',
              }, null, 2),
            },
          ],
        };
      }

      return {
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
    }

    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown tool: ${name}`
    );
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    Logger.error(`Error in tool ${name}`, error, { toolName: name });
    throw ErrorHandler.createMcpError(
      ErrorCode.InternalError,
      `Internal error in tool ${name}`,
      undefined,
      [
        'Check server logs for more details',
        'Retry the request',
        'Contact support if the problem persists'
      ]
    );
  }
});

// Graceful shutdown handling
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  Logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    // Clear any caches
    ruleManager.clearCache();
    Logger.info('Cache cleared during shutdown');

    // Exit gracefully
    process.exit(0);
  } catch (error) {
    Logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught exception', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled rejection', reason, { promise: String(promise) });
  gracefulShutdown('unhandledRejection');
});

// CLI argument handling
function handleCliArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Agent Rules MCP Server v1.0.0

A Model Context Protocol server that provides development rules and best practices
from a remote GitHub repository.

Usage:
  agent-rules-mcp [options]

Options:
  --help, -h     Show this help message
  --version, -v  Show version information

The server fetches rules from a configurable GitHub repository.
Configure via environment variables: GITHUB_OWNER, GITHUB_REPO, GITHUB_PATH, GITHUB_BRANCH

Examples:
  agent-rules-mcp                    # Start server and fetch from GitHub

The server provides two MCP tools:
  - get_rules(domain)  Get rule content for a specific domain
  - list_rules()       List all available rule domains

For more information, visit: https://github.com/4regab/agent-rules-mcp
`);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log('agent-rules-mcp v1.3.0');
    process.exit(0);
  }
}

async function main() {
  // Handle CLI arguments first
  handleCliArgs();

  try {
    Logger.info('Starting Agent Rules MCP server v1.0.0');
    Logger.info(`GitHub repository: ${ruleManager.getRulesDirectory()}`);
    Logger.info(`Node.js version: ${process.version}`);
    Logger.info(`Platform: ${process.platform} ${process.arch}`);

    // Validate rules directory exists and is accessible
    const domains = await ruleManager.listAvailableDomains();
    Logger.info(`Found ${domains.length} rule domain${domains.length === 1 ? '' : 's'}`);

    if (domains.length === 0) {
      Logger.warn('No rule files found in the GitHub repository', {
        repository: ruleManager.getRulesDirectory()
      });
    } else {
      Logger.info(`Available domains: ${domains.map(d => d.domain).join(', ')}`);
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);

    Logger.info('✓ Agent Rules MCP server running on stdio');
    Logger.info('Server ready to accept MCP requests');
    Logger.info('Use Ctrl+C to stop the server');

  } catch (error) {
    Logger.error('Failed to start server', error);
    process.exit(1);
  }
}

main().catch((error) => {
  Logger.error('Server failed to start', error);
  process.exit(1);
});