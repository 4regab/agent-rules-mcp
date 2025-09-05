#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { RuleManager } from './rule-manager.js';
import { ErrorHandler, Logger } from './error-handler.js';

const ruleManager = new RuleManager();
const server = new Server({ name: 'agent-rules-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });

const TOOLS = [
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
        domain: { type: 'string', description: 'The domain name to retrieve rules for (e.g., "react", "security"). Use this for single domain requests.' },
        domains: { type: 'array', items: { type: 'string' }, description: 'Array of domain names to retrieve rules for. Use ALL available domain names from list_rules when user requests "apply all rules" (e.g., ["react", "security", "nextjs", "typescript", "clean-code", ...]). Use this for multiple domain requests.' }
      }
    }
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
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  }
] as const;

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

const validateArgs = (args: unknown) => {
  if (!args || typeof args !== 'object') {
    throw ErrorHandler.createMcpError(ErrorCode.InvalidParams, 'Invalid arguments: expected object with domain or domains property', undefined,
      ['Provide a domain parameter as a string: {"domain": "react"}', 'Or provide domains parameter as an array: {"domains": ["react", "security"]}']);
  }
};

const validateDomainInput = (domain: unknown, domains: unknown): string[] => {
  const hasOnlyDomain = domain && !domains;
  const hasOnlyDomains = domains && !domain;

  if (!hasOnlyDomain && !hasOnlyDomains) {
    throw ErrorHandler.createMcpError(ErrorCode.InvalidParams, 'Must provide either domain or domains parameter, but not both', undefined,
      ['For single domain: {"domain": "react"}', 'For multiple domains: {"domains": ["react", "security"]}']);
  }

  if (hasOnlyDomain) {
    if (typeof domain !== 'string' || domain.trim().length === 0) throw ErrorHandler.handleDomainValidationError(domain as string);
    return [domain as string];
  }

  if (!Array.isArray(domains) || domains.length === 0) {
    throw ErrorHandler.createMcpError(ErrorCode.InvalidParams,
      Array.isArray(domains) && domains.length === 0 ? 'Domains array cannot be empty' : 'Invalid domains parameter: must be an array of strings',
      undefined, ['Provide at least one domain in the array', 'Example: {"domains": ["react"]}']);
  }

  domains.forEach(d => {
    if (typeof d !== 'string' || d.trim().length === 0) {
      throw ErrorHandler.createMcpError(ErrorCode.InvalidParams, 'All domains must be non-empty strings', undefined,
        ['Ensure all items in domains array are valid strings', 'Example: {"domains": ["react", "security"]}']);
    }
  });

  return domains as string[];
};

const sanitizeDomains = (domains: string[]): string[] => domains.map(d => {
  const sanitized = d.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (sanitized !== d) throw ErrorHandler.handleDomainValidationError(d);
  return sanitized;
});

const processRuleResults = async (sanitizedDomains: string[]) => {
  const results = await Promise.allSettled(sanitizedDomains.map(async (domain) => {
    const ruleContent = await ruleManager.getRuleContentSafe(domain);
    if (!ruleContent) throw new Error(`Rule not found for domain: ${domain}`);
    return { domain: ruleContent.domain, content: ruleContent.content };
  }));

  const successfulResults = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled').map(r => r.value);
  const failedDomains = results.map((r, i) => r.status === 'rejected' ? sanitizedDomains[i] : null).filter(Boolean) as string[];

  if (successfulResults.length === 0) {
    const availableDomains = await ruleManager.listAvailableDomains();
    throw ErrorHandler.createMcpError(ErrorCode.InvalidParams, `No rules found for any of the requested domains: ${failedDomains.join(', ')}`, undefined, [
      'Check if the domain names are spelled correctly', 'Use list_rules to see available domains',
      `Available domains: ${availableDomains.map(d => d.domain).join(', ')}`, 'Domain names should match the filename without .md extension'
    ]);
  }

  return { successfulResults, failedDomains };
};

const formatResponse = (data: any) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'get_rules') {
      validateArgs(args);
      const { domain, domains } = args as { domain?: unknown; domains?: unknown };
      const domainsToProcess = validateDomainInput(domain, domains);
      const sanitizedDomains = sanitizeDomains(domainsToProcess);
      const { successfulResults, failedDomains } = await processRuleResults(sanitizedDomains);

      const responseData = domainsToProcess.length === 1
        ? { title: successfulResults[0].domain, content: successfulResults[0].content }
        : { rules: successfulResults.map(rule => ({ title: rule.domain, content: rule.content })), total: successfulResults.length, ...(failedDomains.length > 0 && { failed: failedDomains }) };

      return formatResponse(responseData);
    }

    if (name === 'list_rules') {
      const domains = await ruleManager.listAvailableDomains();
      const responseData = domains.length === 0
        ? { domains: [], totalCount: 0, message: 'No rule files found in the GitHub repository.' }
        : { domains: domains.map(({ domain, description, lastUpdated }) => ({ domain, description, lastUpdated })), totalCount: domains.length, message: `Found ${domains.length} rule domain${domains.length === 1 ? '' : 's'}` };

      return formatResponse(responseData);
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  } catch (error) {
    if (error instanceof McpError) throw error;
    Logger.error(`Error in tool ${name}`, error, { toolName: name });
    throw ErrorHandler.createMcpError(ErrorCode.InternalError, `Internal error in tool ${name}`, undefined,
      ['Check server logs for more details', 'Retry the request', 'Contact support if the problem persists']);
  }
});

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  Logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    ruleManager.clearCache();
    Logger.info('Cache cleared during shutdown');
    process.exit(0);
  } catch (error) {
    Logger.error('Error during shutdown', error);
    process.exit(1);
  }
};

['SIGINT', 'SIGTERM', 'uncaughtException', 'unhandledRejection'].forEach(signal => {
  process.on(signal as any, (errorOrReason?: any, promise?: any) => {
    if (signal === 'unhandledRejection') Logger.error('Unhandled rejection', errorOrReason, { promise: String(promise) });
    else if (signal === 'uncaughtException') Logger.error('Uncaught exception', errorOrReason);
    gracefulShutdown(signal);
  });
});

const handleCliArgs = () => {
  const args = process.argv.slice(2);
  const hasHelp = args.some(arg => ['--help', '-h'].includes(arg));
  const hasVersion = args.some(arg => ['--version', '-v'].includes(arg));

  if (hasHelp) {
    console.log(`Agent Rules MCP Server v1.3.2\n\nA Model Context Protocol server that provides development rules and best practices\nfrom a remote GitHub repository.\n\nUsage:\n  agent-rules-mcp [options]\n\nOptions:\n  --help, -h     Show this help message\n  --version, -v  Show version information\n\nThe server fetches rules from a configurable GitHub repository.\nConfigure via environment variables: GITHUB_OWNER, GITHUB_REPO, GITHUB_PATH, GITHUB_BRANCH\n\nExamples:\n  agent-rules-mcp                    # Start server and fetch from GitHub\n\nThe server provides two MCP tools:\n  - get_rules(domain)  Get rule content for a specific domain\n  - list_rules()       List all available rule domains\n\nFor more information, visit: https://github.com/4regab/agent-rules-mcp`);
    process.exit(0);
  }

  if (hasVersion) {
    console.log('agent-rules-mcp v1.3.2');
    process.exit(0);
  }
};

const main = async () => {
  handleCliArgs();

  try {
    ['Starting Agent Rules MCP server v1.3.2', `GitHub repository: ${ruleManager.getRulesDirectory()}`,
      `Node.js version: ${process.version}`, `Platform: ${process.platform} ${process.arch}`]
      .forEach(info => Logger.info(info));

    const domains = await ruleManager.listAvailableDomains();
    Logger.info(`Found ${domains.length} rule domain${domains.length === 1 ? '' : 's'}`);

    if (domains.length === 0) Logger.warn('No rule files found in the GitHub repository', { repository: ruleManager.getRulesDirectory() });
    else Logger.info(`Available domains: ${domains.map(d => d.domain).join(', ')}`);

    await server.connect(new StdioServerTransport());

    ['✓ Agent Rules MCP server running on stdio', 'Server ready to accept MCP requests', 'Use Ctrl+C to stop the server']
      .forEach(msg => Logger.info(msg));

  } catch (error) {
    Logger.error('Failed to start server', error);
    process.exit(1);
  }
};

main().catch((error) => {
  Logger.error('Server failed to start', error);
  process.exit(1);
});