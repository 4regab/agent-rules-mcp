import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Custom error types for the agent-rules-mcp server
 */
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

/**
 * Structured error response interface
 */
export interface ErrorResponse {
  error: string;
  code: string;
  details?: string;
  suggestions?: string[];
}

/**
 * Logger utility for consistent error logging
 */
export class Logger {
  private static formatTimestamp(): string {
    return new Date().toISOString();
  }

  static error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    const timestamp = this.formatTimestamp();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    
    console.error(`[${timestamp}] ERROR: ${message}${error ? ` | ${errorMessage}` : ''}${contextStr}`);
  }

  static warn(message: string, context?: Record<string, unknown>): void {
    const timestamp = this.formatTimestamp();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    
    console.error(`[${timestamp}] WARN: ${message}${contextStr}`);
  }

  static info(message: string, context?: Record<string, unknown>): void {
    const timestamp = this.formatTimestamp();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    
    console.error(`[${timestamp}] INFO: ${message}${contextStr}`);
  }
}

/**
 * Error handler utility for creating structured MCP errors
 */
export class ErrorHandler {
  /**
   * Create a structured MCP error with helpful suggestions
   */
  static createMcpError(
    code: ErrorCode,
    message: string,
    agentRulesCode?: AgentRulesErrorCode,
    suggestions?: string[]
  ): McpError {
    Logger.error(`MCP Error: ${message}`, undefined, { 
      code, 
      agentRulesCode, 
      suggestions 
    });

    let enhancedMessage = message;
    if (suggestions && suggestions.length > 0) {
      enhancedMessage += `\n\nSuggestions:\n${suggestions.map(s => `- ${s}`).join('\n')}`;
    }

    return new McpError(code, enhancedMessage);
  }

  /**
   * Handle file system errors with specific error codes and suggestions
   */
  static handleFileSystemError(error: unknown, domain?: string): McpError {
    if (error instanceof Error && 'code' in error) {
      const fsError = error as NodeJS.ErrnoException;
      
      switch (fsError.code) {
        case 'ENOENT':
          if (domain) {
            return this.createMcpError(
              ErrorCode.InvalidParams,
              `Rule file not found for domain: ${domain}`,
              AgentRulesErrorCode.RULE_FILE_NOT_FOUND,
              [
                'Check if the domain name is spelled correctly',
                'Use list_rules to see available domains',
                'Ensure the rule file exists in the rules/ directory',
                'Domain names should match the filename without .md extension'
              ]
            );
          } else {
            return this.createMcpError(
              ErrorCode.InternalError,
              'Rules directory not found',
              AgentRulesErrorCode.RULES_DIRECTORY_NOT_FOUND,
              [
                'Create a rules/ directory in the project root',
                'Add .md files to the rules/ directory',
                'Check the RULES_DIRECTORY environment variable if set'
              ]
            );
          }

        case 'EACCES':
          if (domain) {
            return this.createMcpError(
              ErrorCode.InternalError,
              `Permission denied accessing rule file for domain: ${domain}`,
              AgentRulesErrorCode.RULE_FILE_ACCESS_DENIED,
              [
                'Check file permissions for the rule file',
                'Ensure the server has read access to the rules/ directory'
              ]
            );
          } else {
            return this.createMcpError(
              ErrorCode.InternalError,
              'Permission denied accessing rules directory',
              AgentRulesErrorCode.RULES_DIRECTORY_ACCESS_DENIED,
              [
                'Check directory permissions for the rules/ directory',
                'Ensure the server has read access to the rules/ directory'
              ]
            );
          }

        case 'EISDIR':
          return this.createMcpError(
            ErrorCode.InvalidParams,
            `Domain name conflicts with directory: ${domain}`,
            AgentRulesErrorCode.INVALID_DOMAIN_NAME,
            [
              'Choose a different domain name',
              'Remove conflicting directory from rules/ folder'
            ]
          );

        default:
          return this.createMcpError(
            ErrorCode.InternalError,
            `File system error: ${fsError.message}`,
            undefined,
            [
              'Check file system permissions',
              'Verify the rules directory structure',
              'Contact system administrator if the problem persists'
            ]
          );
      }
    }

    return this.createMcpError(
      ErrorCode.InternalError,
      `Unexpected file system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      [
        'Check server logs for more details',
        'Verify the rules directory structure',
        'Restart the server if the problem persists'
      ]
    );
  }

  /**
   * Handle domain validation errors
   */
  static handleDomainValidationError(domain: string): McpError {
    if (!domain || domain.trim().length === 0) {
      return this.createMcpError(
        ErrorCode.InvalidParams,
        'Domain parameter cannot be empty',
        AgentRulesErrorCode.EMPTY_DOMAIN_NAME,
        [
          'Provide a valid domain name',
          'Use list_rules to see available domains',
          'Domain names should be alphanumeric with hyphens or underscores'
        ]
      );
    }

    const sanitizedDomain = domain.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (sanitizedDomain !== domain) {
      return this.createMcpError(
        ErrorCode.InvalidParams,
        'Invalid domain name: only alphanumeric characters, hyphens, and underscores are allowed',
        AgentRulesErrorCode.INVALID_DOMAIN_NAME,
        [
          'Use only letters, numbers, hyphens (-), and underscores (_)',
          'Remove special characters and spaces',
          'Examples: "react", "next-js", "security_rules"'
        ]
      );
    }

    return this.createMcpError(
      ErrorCode.InvalidParams,
      `Invalid domain: ${domain}`,
      AgentRulesErrorCode.INVALID_DOMAIN_NAME,
      [
        'Check the domain name format',
        'Use list_rules to see available domains'
      ]
    );
  }

  /**
   * Handle parsing errors
   */
  static handleParseError(domain: string, error: unknown): McpError {
    return this.createMcpError(
      ErrorCode.InternalError,
      `Failed to parse rule file for domain: ${domain}`,
      AgentRulesErrorCode.RULE_FILE_PARSE_ERROR,
      [
        'Check if the rule file is valid markdown',
        'Ensure the file is not corrupted',
        'Verify the file encoding is UTF-8',
        'Contact the rule file author if the problem persists'
      ]
    );
  }

  /**
   * Handle concurrent request errors
   */
  static handleConcurrentRequestError(domain: string, error: unknown): McpError {
    return this.createMcpError(
      ErrorCode.InternalError,
      `Concurrent request error for domain: ${domain}`,
      AgentRulesErrorCode.CONCURRENT_REQUEST_ERROR,
      [
        'Retry the request',
        'Reduce concurrent requests to the same domain',
        'Contact support if the problem persists'
      ]
    );
  }
}

/**
 * Utility to ensure server continues operating when individual operations fail
 */
export class OperationContinuity {
  /**
   * Execute an operation with error isolation
   * If the operation fails, log the error but don't crash the server
   */
  static async executeWithContinuity<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallbackValue: T
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      Logger.error(`Operation failed but server continues: ${operationName}`, error);
      return fallbackValue;
    }
  }

  /**
   * Execute multiple operations with error isolation
   * Failed operations are logged but don't affect successful ones
   */
  static async executeMultipleWithContinuity<T>(
    operations: Array<() => Promise<T>>,
    operationName: string
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await operations[i]();
        results.push(result);
      } catch (error) {
        Logger.error(`Operation ${i + 1} failed in ${operationName}`, error);
        // Continue with other operations
      }
    }
    
    return results;
  }
}