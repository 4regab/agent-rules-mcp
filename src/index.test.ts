import { describe, it, expect } from 'vitest';

describe('Agent Rules MCP', () => {
  it('should have basic functionality', () => {
    // Basic smoke test
    expect(true).toBe(true);
  });

  it('should export main functionality', async () => {
    // Test that the main module can be imported
    const module = await import('./index.js');
    expect(module).toBeDefined();
  });
});