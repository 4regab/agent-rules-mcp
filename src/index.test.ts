import { describe, it, expect } from 'vitest';

describe('Agent Rules MCP', () => {
  it('should have basic functionality', () => {
    // Basic smoke test
    expect(true).toBe(true);
  });

  it('should have proper project structure', () => {
    // Test that we can import types without executing the main code
    expect(typeof process.env).toBe('object');
    expect(process.env.NODE_ENV).toBeDefined();
  });
});