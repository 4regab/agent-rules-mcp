import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export enum AgentRulesErrorCode {
  RULES_DIRECTORY_NOT_FOUND = 'RULES_DIRECTORY_NOT_FOUND',
  RULES_DIRECTORY_ACCESS_DENIED = 'RULES_DIRECTORY_ACCESS_DENIED',
  RULE_FILE_NOT_FOUND = 'RULE_FILE_NOT_FOUND',
  RULE_FILE_ACCESS_DENIED = 'RULE_FILE_ACCESS_DENIED',
  RULE_FILE_PARSE_ERROR = 'RULE_FILE_PARSE_ERROR',
  INVALID_DOMAIN_NAME = 'INVALID_DOMAIN_NAME',
  EMPTY_DOMAIN_NAME = 'EMPTY_DOMAIN_NAME',
  CONCURRENT_REQUEST_ERROR = 'CONCURRENT_REQUEST_ERROR',
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: string;
  suggestions?: string[];
}

export class Logger {
  private static formatMessage(level: string, message: string, error?: Error | unknown, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level}: ${message}${error ? ` | ${errorMessage}` : ''}${contextStr}`;
  }

  static error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    console.error(this.formatMessage('ERROR', message, error, context));
  }

  static warn(message: string, context?: Record<string, unknown>): void {
    console.error(this.formatMessage('WARN', message, undefined, context));
  }

  static info(message: string, context?: Record<string, unknown>): void {
    console.error(this.formatMessage('INFO', message, undefined, context));
  }
}

export class ErrorHandler {
  static createMcpError(code: ErrorCode, message: string, agentRulesCode?: AgentRulesErrorCode, suggestions?: string[]): McpError {
    Logger.error(`MCP Error: ${message}`, undefined, { code, agentRulesCode, suggestions });

    const enhancedMessage = suggestions?.length
      ? `${message}\n\nSuggestions:\n${suggestions.map(s => `- ${s}`).join('\n')}`
      : message;

    return new McpError(code, enhancedMessage);
  }

  static handleFileSystemError(error: unknown, domain?: string): McpError {
    if (error instanceof Error && 'code' in error) {
      const fsError = error as NodeJS.ErrnoException;

      switch (fsError.code) {
        case 'ENOENT':
          return domain
            ? this.createMcpError(ErrorCode.InvalidParams, `Rule file not found for domain: ${domain}`, AgentRulesErrorCode.RULE_FILE_NOT_FOUND,
              ['Check if the domain name is spelled correctly', 'Use list_rules to see available domains', 'Ensure the rule file exists in the rules/ directory', 'Domain names should match the filename without .md extension'])
            : this.createMcpError(ErrorCode.InternalError, 'Rules directory not found', AgentRulesErrorCode.RULES_DIRECTORY_NOT_FOUND,
              ['Create a rules/ directory in the project root', 'Add .md files to the rules/ directory', 'Check the RULES_DIRECTORY environment variable if set']);

        case 'EACCES':
          return domain
            ? this.createMcpError(ErrorCode.InternalError, `Permission denied accessing rule file for domain: ${domain}`, AgentRulesErrorCode.RULE_FILE_ACCESS_DENIED,
              ['Check file permissions for the rule file', 'Ensure the server has read access to the rules/ directory'])
            : this.createMcpError(ErrorCode.InternalError, 'Permission denied accessing rules directory', AgentRulesErrorCode.RULES_DIRECTORY_ACCESS_DENIED,
              ['Check directory permissions for the rules/ directory', 'Ensure the server has read access to the rules/ directory']);

        case 'EISDIR':
          return this.createMcpError(ErrorCode.InvalidParams, `Domain name conflicts with directory: ${domain}`, AgentRulesErrorCode.INVALID_DOMAIN_NAME,
            ['Choose a different domain name', 'Remove conflicting directory from rules/ folder']);

        default:
          return this.createMcpError(ErrorCode.InternalError, `File system error: ${fsError.message}`, undefined,
            ['Check file system permissions', 'Verify the rules directory structure', 'Contact system administrator if the problem persists']);
      }
    }

    return this.createMcpError(ErrorCode.InternalError, `Unexpected file system error: ${error instanceof Error ? error.message : 'Unknown error'}`, undefined,
      ['Check server logs for more details', 'Verify the rules directory structure', 'Restart the server if the problem persists']);
  }

  static handleDomainValidationError(domain: string): McpError {
    if (!domain || domain.trim().length === 0) {
      return this.createMcpError(ErrorCode.InvalidParams, 'Domain parameter cannot be empty', AgentRulesErrorCode.EMPTY_DOMAIN_NAME,
        ['Provide a valid domain name', 'Use list_rules to see available domains', 'Domain names should be alphanumeric with hyphens or underscores']);
    }

    const sanitizedDomain = domain.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (sanitizedDomain !== domain) {
      return this.createMcpError(ErrorCode.InvalidParams, 'Invalid domain name: only alphanumeric characters, hyphens, and underscores are allowed', AgentRulesErrorCode.INVALID_DOMAIN_NAME,
        ['Use only letters, numbers, hyphens (-), and underscores (_)', 'Remove special characters and spaces', 'Examples: "react", "next-js", "security_rules"']);
    }

    return this.createMcpError(ErrorCode.InvalidParams, `Invalid domain: ${domain}`, AgentRulesErrorCode.INVALID_DOMAIN_NAME,
      ['Check the domain name format', 'Use list_rules to see available domains']);
  }

  static handleParseError(domain: string, error: unknown): McpError {
    return this.createMcpError(ErrorCode.InternalError, `Failed to parse rule file for domain: ${domain}`, AgentRulesErrorCode.RULE_FILE_PARSE_ERROR,
      ['Check if the rule file is valid markdown', 'Ensure the file is not corrupted', 'Verify the file encoding is UTF-8', 'Contact the rule file author if the problem persists']);
  }

  static handleConcurrentRequestError(domain: string, error: unknown): McpError {
    return this.createMcpError(ErrorCode.InternalError, `Concurrent request error for domain: ${domain}`, AgentRulesErrorCode.CONCURRENT_REQUEST_ERROR,
      ['Retry the request', 'Reduce concurrent requests to the same domain', 'Contact support if the problem persists']);
  }
}

export class OperationContinuity {
  static async executeWithContinuity<T>(operation: () => Promise<T>, operationName: string, fallbackValue: T): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      Logger.error(`Operation failed but server continues: ${operationName}`, error);
      return fallbackValue;
    }
  }

  static async executeMultipleWithContinuity<T>(operations: Array<() => Promise<T>>, operationName: string): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await operations[i]();
        results.push(result);
      } catch (error) {
        Logger.error(`Operation ${i + 1} failed in ${operationName}`, error);
      }
    }

    return results;
  }
}