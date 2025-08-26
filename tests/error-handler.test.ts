import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { 
  ErrorHandler, 
  Logger, 
  OperationContinuity, 
  AgentRulesErrorCode 
} from './error-handler.js';

describe('ErrorHandler', () => {
  let consoleSpy: any;

  beforeEach(() => {
    // Mock console methods to avoid noise in test output
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore console methods
    Object.values(consoleSpy).forEach((spy: any) => spy.mockRestore());
  });

  describe('createMcpError', () => {
    it('should create basic MCP error', () => {
      const error = ErrorHandler.createMcpError(
        ErrorCode.InvalidParams,
        'Test error message'
      );

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InvalidParams);
      expect(error.message).toContain('Test error message');
    });

    it('should create MCP error with suggestions', () => {
      const suggestions = ['Try this', 'Or try that'];
      const error = ErrorHandler.createMcpError(
        ErrorCode.InvalidParams,
        'Test error message',
        AgentRulesErrorCode.INVALID_DOMAIN_NAME,
        suggestions
      );

      expect(error.message).toContain('Test error message');
      expect(error.message).toContain('Suggestions:');
      expect(error.message).toContain('- Try this');
      expect(error.message).toContain('- Or try that');
    });

    it('should log error details', () => {
      ErrorHandler.createMcpError(
        ErrorCode.InvalidParams,
        'Test error message',
        AgentRulesErrorCode.INVALID_DOMAIN_NAME,
        ['Suggestion 1']
      );

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('MCP Error: Test error message')
      );
    });
  });

  describe('handleFileSystemError', () => {
    it('should handle ENOENT error for domain', () => {
      const fsError = new Error('File not found') as NodeJS.ErrnoException;
      fsError.code = 'ENOENT';

      const error = ErrorHandler.handleFileSystemError(fsError, 'test-domain');

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InvalidParams);
      expect(error.message).toContain('Rule file not found for domain: test-domain');
      expect(error.message).toContain('Check if the domain name is spelled correctly');
    });

    it('should handle ENOENT error for directory', () => {
      const fsError = new Error('Directory not found') as NodeJS.ErrnoException;
      fsError.code = 'ENOENT';

      const error = ErrorHandler.handleFileSystemError(fsError);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Rules directory not found');
      expect(error.message).toContain('Create a rules/ directory');
    });

    it('should handle EACCES error for domain', () => {
      const fsError = new Error('Permission denied') as NodeJS.ErrnoException;
      fsError.code = 'EACCES';

      const error = ErrorHandler.handleFileSystemError(fsError, 'test-domain');

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Permission denied accessing rule file for domain: test-domain');
      expect(error.message).toContain('Check file permissions');
    });

    it('should handle EACCES error for directory', () => {
      const fsError = new Error('Permission denied') as NodeJS.ErrnoException;
      fsError.code = 'EACCES';

      const error = ErrorHandler.handleFileSystemError(fsError);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Permission denied accessing rules directory');
    });

    it('should handle EISDIR error', () => {
      const fsError = new Error('Is a directory') as NodeJS.ErrnoException;
      fsError.code = 'EISDIR';

      const error = ErrorHandler.handleFileSystemError(fsError, 'test-domain');

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InvalidParams);
      expect(error.message).toContain('Domain name conflicts with directory: test-domain');
    });

    it('should handle unknown file system errors', () => {
      const fsError = new Error('Unknown error') as NodeJS.ErrnoException;
      fsError.code = 'EUNKNOWN';

      const error = ErrorHandler.handleFileSystemError(fsError);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('File system error: Unknown error');
    });

    it('should handle non-file system errors', () => {
      const genericError = new Error('Generic error');

      const error = ErrorHandler.handleFileSystemError(genericError);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Unexpected file system error: Generic error');
    });

    it('should handle non-Error objects', () => {
      const stringError = 'String error';

      const error = ErrorHandler.handleFileSystemError(stringError);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Unexpected file system error');
    });
  });

  describe('handleDomainValidationError', () => {
    it('should handle empty domain', () => {
      const error = ErrorHandler.handleDomainValidationError('');

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InvalidParams);
      expect(error.message).toContain('Domain parameter cannot be empty');
    });

    it('should handle whitespace-only domain', () => {
      const error = ErrorHandler.handleDomainValidationError('   ');

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InvalidParams);
      expect(error.message).toContain('Domain parameter cannot be empty');
    });

    it('should handle domain with invalid characters', () => {
      const error = ErrorHandler.handleDomainValidationError('invalid domain');

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InvalidParams);
      expect(error.message).toContain('Invalid domain name: only alphanumeric characters, hyphens, and underscores are allowed');
      expect(error.message).toContain('Examples: "react", "next-js", "security_rules"');
    });

    it('should handle domain with special characters', () => {
      const error = ErrorHandler.handleDomainValidationError('test@domain');

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InvalidParams);
      expect(error.message).toContain('Invalid domain name: only alphanumeric characters, hyphens, and underscores are allowed');
    });

    it('should handle path traversal attempts', () => {
      const error = ErrorHandler.handleDomainValidationError('../../../etc/passwd');

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InvalidParams);
      expect(error.message).toContain('Invalid domain name: only alphanumeric characters, hyphens, and underscores are allowed');
    });

    it('should handle valid domain that somehow fails validation', () => {
      // This tests the fallback case in the validation logic
      const error = ErrorHandler.handleDomainValidationError('valid-domain');

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InvalidParams);
      expect(error.message).toContain('Invalid domain: valid-domain');
    });
  });

  describe('handleParseError', () => {
    it('should handle parsing errors', () => {
      const parseError = new Error('Invalid markdown');
      const error = ErrorHandler.handleParseError('test-domain', parseError);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Failed to parse rule file for domain: test-domain');
      expect(error.message).toContain('Check if the rule file is valid markdown');
    });

    it('should handle non-Error parse failures', () => {
      const error = ErrorHandler.handleParseError('test-domain', 'Parse failed');

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Failed to parse rule file for domain: test-domain');
    });
  });

  describe('handleConcurrentRequestError', () => {
    it('should handle concurrent request errors', () => {
      const concurrentError = new Error('Concurrent access failed');
      const error = ErrorHandler.handleConcurrentRequestError('test-domain', concurrentError);

      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
      expect(error.message).toContain('Concurrent request error for domain: test-domain');
      expect(error.message).toContain('Retry the request');
    });
  });
});

describe('Logger', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    consoleSpy.error.mockRestore();
  });

  describe('error', () => {
    it('should log error with timestamp', () => {
      Logger.error('Test error message');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: Test error message$/)
      );
    });

    it('should log error with Error object', () => {
      const error = new Error('Test error');
      Logger.error('Test message', error);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: Test message \| Test error$/)
      );
    });

    it('should log error with context', () => {
      Logger.error('Test message', undefined, { domain: 'test', operation: 'read' });

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: Test message \| Context: {"domain":"test","operation":"read"}$/)
      );
    });

    it('should log error with all parameters', () => {
      const error = new Error('Test error');
      Logger.error('Test message', error, { domain: 'test' });

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: Test message \| Test error \| Context: {"domain":"test"}$/)
      );
    });

    it('should handle non-Error objects', () => {
      Logger.error('Test message', 'string error');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: Test message \| string error$/)
      );
    });
  });

  describe('warn', () => {
    it('should log warning with timestamp', () => {
      Logger.warn('Test warning');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] WARN: Test warning$/)
      );
    });

    it('should log warning with context', () => {
      Logger.warn('Test warning', { domain: 'test' });

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] WARN: Test warning \| Context: {"domain":"test"}$/)
      );
    });
  });

  describe('info', () => {
    it('should log info with timestamp', () => {
      Logger.info('Test info');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Test info$/)
      );
    });

    it('should log info with context', () => {
      Logger.info('Test info', { operation: 'startup' });

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Test info \| Context: {"operation":"startup"}$/)
      );
    });
  });
});

describe('OperationContinuity', () => {
  describe('executeWithContinuity', () => {
    it('should return result when operation succeeds', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await OperationContinuity.executeWithContinuity(
        operation,
        'test operation',
        'fallback'
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledOnce();
    });

    it('should return fallback when operation fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      const result = await OperationContinuity.executeWithContinuity(
        operation,
        'test operation',
        'fallback'
      );

      expect(result).toBe('fallback');
      expect(operation).toHaveBeenCalledOnce();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed but server continues: test operation')
      );

      consoleSpy.mockRestore();
    });

    it('should handle different data types', async () => {
      const operation = vi.fn().mockResolvedValue({ data: 'object' });
      
      const result = await OperationContinuity.executeWithContinuity(
        operation,
        'test operation',
        { data: 'fallback' }
      );

      expect(result).toEqual({ data: 'object' });
    });
  });

  describe('executeMultipleWithContinuity', () => {
    it('should return all results when all operations succeed', async () => {
      const operations = [
        vi.fn().mockResolvedValue('result1'),
        vi.fn().mockResolvedValue('result2'),
        vi.fn().mockResolvedValue('result3'),
      ];
      
      const results = await OperationContinuity.executeMultipleWithContinuity(
        operations,
        'test operations'
      );

      expect(results).toEqual(['result1', 'result2', 'result3']);
      operations.forEach(op => expect(op).toHaveBeenCalledOnce());
    });

    it('should continue with other operations when some fail', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const operations = [
        vi.fn().mockResolvedValue('result1'),
        vi.fn().mockRejectedValue(new Error('Operation 2 failed')),
        vi.fn().mockResolvedValue('result3'),
        vi.fn().mockRejectedValue(new Error('Operation 4 failed')),
        vi.fn().mockResolvedValue('result5'),
      ];
      
      const results = await OperationContinuity.executeMultipleWithContinuity(
        operations,
        'test operations'
      );

      expect(results).toEqual(['result1', 'result3', 'result5']);
      operations.forEach(op => expect(op).toHaveBeenCalledOnce());
      
      // Should log errors for failed operations
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation 2 failed in test operations')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation 4 failed in test operations')
      );

      consoleSpy.mockRestore();
    });

    it('should handle empty operations array', async () => {
      const results = await OperationContinuity.executeMultipleWithContinuity(
        [],
        'empty operations'
      );

      expect(results).toEqual([]);
    });

    it('should handle all operations failing', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const operations = [
        vi.fn().mockRejectedValue(new Error('Operation 1 failed')),
        vi.fn().mockRejectedValue(new Error('Operation 2 failed')),
      ];
      
      const results = await OperationContinuity.executeMultipleWithContinuity(
        operations,
        'failing operations'
      );

      expect(results).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });
});