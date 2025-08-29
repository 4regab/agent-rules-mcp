---
inclusion: fileMatch
fileMatchPattern: "*.md"
---

# Documentation Standards

## README Structure

### Essential Sections
- Clear project description and purpose
- Installation and configuration instructions
- Usage examples with code snippets
- API/tool documentation
- Contributing guidelines
- License information

### MCP-Specific Documentation
- Client configuration examples for popular MCP clients
- Environment variable documentation
- Tool descriptions and parameters
- Example use cases and workflows

## Code Documentation

### TypeScript Documentation
- Use JSDoc comments for public APIs
- Document complex algorithms and business logic
- Include parameter and return type descriptions
- Provide usage examples in comments

### Example Documentation Format
```typescript
/**
 * Retrieves coding rules from GitHub repository
 * @param domain - Single domain name to fetch rules for
 * @param domains - Array of domain names for batch fetching
 * @returns Promise resolving to rule content and metadata
 * @throws {Error} When repository access fails or domain not found
 */
```

## Configuration Documentation

### Environment Variables
Document all environment variables with:
- Purpose and usage
- Required vs optional status
- Default values
- Example configurations

### MCP Client Setup
Provide complete configuration examples for:
- VS Code with MCP extension
- Kiro IDE
- Cursor IDE
- Windsurf IDE
- Custom MCP clients

## User Guides

### Quick Start Guide
- Minimal setup instructions
- Basic usage examples
- Common troubleshooting steps

### Advanced Configuration
- Custom repository setup
- Private repository access
- Performance optimization
- Integration with existing workflows

## API Documentation

### Tool Specifications
Document each MCP tool with:
- Purpose and functionality
- Parameter schemas and types
- Response formats and examples
- Error conditions and handling

### Integration Examples
Provide real-world examples of:
- Fetching specific rule domains
- Batch rule retrieval
- Error handling patterns
- Performance optimization techniques

## Changelog and Versioning

### Version Documentation
- Follow semantic versioning principles
- Document breaking changes clearly
- Include migration guides for major versions
- Maintain backward compatibility notes

### Release Notes Format
```markdown
## [1.3.0] - 2024-XX-XX
### Added
- New feature descriptions
### Changed
- Modified functionality
### Fixed
- Bug fixes and improvements
```