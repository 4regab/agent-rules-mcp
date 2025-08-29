---
inclusion: fileMatch
fileMatchPattern: "*.ts"
---

# MCP Integration Guidelines

## MCP Server Configuration

### Client Configuration Examples
When helping users configure this MCP server, provide these standard configurations:

**Default Configuration:**
```json
{
  "mcpServers": {
    "agent-rules": {
      "command": "npx",
      "args": ["-y", "agent-rules-mcp@latest"],
      "env": {
        "GITHUB_OWNER": "4regab",
        "GITHUB_REPO": "agent-rules-mcp", 
        "GITHUB_PATH": "rules",
        "GITHUB_BRANCH": "master"
      },
      "disabled": false
    }
  }
}
```

**Community Collections:**
- GitHub Awesome Copilot: `github/awesome-copilot` with path `instructions`
- Awesome Cursor Rules: `PatrickJS/awesome-cursorrules` with path `rules-new`

## Tool Implementation Standards

### get_rules Tool
- Support both single domain (`domain`) and multiple domains (`domains`) parameters
- Handle "apply all rules" requests by fetching ALL available domains
- Return structured content with proper error handling
- Maintain backward compatibility with existing rule formats

### list_rules Tool
- Return comprehensive domain listings with descriptions
- Extract metadata from YAML frontmatter when available
- Generate fallback descriptions from content
- Include last updated timestamps when available

## Environment Variable Handling

### Required Variables
- `GITHUB_OWNER`: Repository owner/organization
- `GITHUB_REPO`: Repository name
- `GITHUB_PATH`: Path to rules folder (default: "rules")
- `GITHUB_BRANCH`: Branch to fetch from (default: "main" or "master")

### Optional Variables
- `GITHUB_TOKEN`: For private repositories or higher rate limits
- `FASTMCP_LOG_LEVEL`: Logging level control

## Error Handling Patterns

### GitHub API Errors
- Handle rate limiting with appropriate retry logic
- Provide clear error messages for repository access issues
- Gracefully handle missing files or directories
- Support both public and private repository access

### Rule Processing Errors
- Validate file formats before processing
- Handle malformed YAML frontmatter gracefully
- Provide fallback descriptions for files without metadata
- Support various file extensions (.md, .mdc, .chatmode.md, etc.)

## Performance Considerations

### Caching Strategy
- Implement appropriate caching for GitHub API responses
- Consider rate limit preservation
- Cache rule content to reduce API calls
- Invalidate cache appropriately for updates

### Batch Operations
- Support fetching multiple domains efficiently
- Minimize API calls when possible
- Handle large rule collections gracefully