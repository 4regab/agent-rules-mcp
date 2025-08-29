---
inclusion: fileMatch
fileMatchPattern: "*.test.ts"
---

# Testing Guidelines for Agent Rules MCP

## Testing Framework

### Vitest Configuration
- Use Vitest as the primary testing framework
- Configure coverage reporting for core functionality
- Use `vitest --run` for CI/production testing
- Use `vitest --watch` for development

### Test Structure
```typescript
// Example test structure
describe('Tool Name', () => {
  beforeEach(() => {
    // Setup mocks and test data
  });

  it('should handle success case', async () => {
    // Test implementation
  });

  it('should handle error case', async () => {
    // Error scenario testing
  });
});
```

## Mock Strategy

### GitHub API Mocking
- Mock all GitHub API calls to avoid rate limits
- Create realistic response data for testing
- Test both success and failure scenarios
- Mock different repository configurations

### Environment Variable Mocking
- Test with various environment configurations
- Validate required vs optional variables
- Test fallback behaviors

## Test Coverage Requirements

### Core Functionality
- Test both `get_rules` and `list_rules` tools
- Verify rule content parsing and metadata extraction
- Test file format support (.md, .mdc, .chatmode.md, etc.)
- Validate error handling for missing files/repos

### Edge Cases
- Test with empty repositories
- Handle malformed YAML frontmatter
- Test with various file naming conventions
- Verify rate limit handling

### Integration Tests
- Test MCP server initialization
- Verify tool registration and execution
- Test environment variable validation
- Validate response formats

## Test Data Management

### Sample Rule Files
Create realistic test data that mirrors actual rule files:
- Files with YAML frontmatter
- Files without metadata
- Various file extensions
- Different content structures

### Repository Structures
Test with different repository layouts:
- Single rules directory
- Nested directory structures
- Mixed file types
- Empty directories

## Performance Testing

### Load Testing
- Test with large rule collections
- Verify memory usage with multiple domains
- Test concurrent request handling

### API Rate Limit Testing
- Simulate GitHub API rate limits
- Test retry logic and backoff strategies
- Verify graceful degradation