---
inclusion: manual
---

# Development Standards for Agent Rules MCP

## Code Quality Standards

### TypeScript Best Practices
- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use proper error handling with typed exceptions
- Follow ES module patterns (this is an ES module project)
- Maintain compatibility with Node.js >=18.0.0

### Code Organization
- Keep source code in `src/` directory
- Use clear, descriptive function and variable names
- Separate concerns: GitHub API logic, MCP server logic, and rule processing
- Export types and interfaces for better maintainability

### Testing Requirements
- Use Vitest for all tests
- Maintain test coverage for core functionality
- Test both success and error scenarios
- Mock external dependencies (GitHub API calls)

## Build and Distribution

### Build Process
- Use `npm run build:prod` for production builds
- Ensure `dist/` directory is clean before builds
- TypeScript compilation serves as linting
- Binary executable should be properly configured in package.json

### NPM Package Standards
- Follow semantic versioning
- Include all necessary files in package.json `files` array
- Maintain proper keywords for discoverability
- Keep dependencies minimal and secure

## MCP Server Implementation

### Tool Implementation
- Follow MCP SDK patterns and conventions
- Provide clear tool descriptions and parameter schemas
- Handle GitHub API rate limits gracefully
- Return structured, consistent responses

### Error Handling
- Provide meaningful error messages
- Handle network failures and API errors
- Validate environment variables on startup
- Log errors appropriately without exposing sensitive data

## GitHub Integration

### API Best Practices
- Use GitHub's REST API efficiently
- Implement proper caching when appropriate
- Handle different file formats (.md, .mdc, .chatmode.md, etc.)
- Support both public and private repositories (when tokens provided)

### Rule Processing
- Extract metadata from YAML frontmatter when available
- Generate fallback descriptions from content
- Support various naming conventions
- Maintain backward compatibility with existing rule formats