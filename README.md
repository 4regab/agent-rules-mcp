# Agent Rules MCP Server

A Model Context Protocol (MCP) server that provides development rules and best practices from local markdown files. This server dynamically loads rules from the `rules/` directory and exposes them through exactly two MCP tools, making it easy for AI agents and developers to access curated development guidance.

## Features

- 🚀 **Simple Setup**: Just add markdown files to the `rules/` directory
- 🔄 **Dynamic Loading**: Automatically detects new rule files without server restart
- 🛠️ **Two MCP Tools**: `get_rules(domain)` and `list_rules()` for easy access
- 📝 **Markdown Format**: Standard markdown with optional metadata
- 🌐 **Community Driven**: Easy contribution via pull requests
- 🔒 **Secure**: File-based approach with no external dependencies

## Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd agent-rules-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## MCP Tools

### `get_rules(domain)`

Retrieves rule content for a specific domain.

**Parameters:**
- `domain` (string): The rule domain to retrieve (filename without .md extension)

**Example Usage:**
```javascript
// Get React development rules
get_rules("react")

// Get security best practices
get_rules("security")

// Get Next.js with Tailwind rules
get_rules("nextjs-tailwind")
```

**Response Format:**
```json
{
  "domain": "react",
  "content": "# React Development Rules\n\n...",
  "metadata": {
    "description": "React development best practices",
    "lastUpdated": "2025-01-26",
    "version": "1.0"
  }
}
```

### `list_rules()`

Lists all available rule domains with descriptions.

**Parameters:** None

**Example Usage:**
```javascript
list_rules()
```

**Response Format:**
```json
{
  "domains": [
    {
      "domain": "react",
      "description": "React development best practices",
      "lastUpdated": "2025-01-26"
    },
    {
      "domain": "security",
      "description": "Security-first mindset OWASP guideline rules",
      "lastUpdated": "2025-08-27"
    }
  ],
  "totalCount": 2
}
```

## Rule File Format

Rule files are standard markdown files placed in the `rules/` directory. The filename (without `.md` extension) becomes the domain name.

### Basic Structure

```markdown
# Domain Name Rules

- Last Updated: YYYY-MM-DD
- Description: Brief description of the rules
- Version: X.X (optional)

## Rule Content

Your rules, best practices, examples, etc. go here.

### Subsections

You can organize your rules into subsections for better readability.
```

### Metadata Section

The metadata section at the top of each rule file is optional but recommended:

- **Last Updated**: Date when the rules were last modified (YYYY-MM-DD format)
- **Description**: Brief description used in `list_rules()` responses
- **Version**: Version number for tracking changes (optional)

### File Naming Convention

- Use kebab-case for filenames: `nextjs-tailwind.md`, `performance-optimization.md`
- Avoid spaces and special characters
- Use descriptive names that clearly indicate the domain

## MCP Client Configuration

### Claude Desktop Configuration

Add to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "agent-rules": {
      "command": "node",
      "args": ["/path/to/agent-rules-mcp/dist/index.js"],
      "env": {
        "RULES_DIRECTORY": "/path/to/agent-rules-mcp/rules"
      }
    }
  }
}
```

### Generic MCP Client Configuration

```json
{
  "servers": {
    "agent-rules-mcp": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/agent-rules-mcp",
      "env": {
        "RULES_DIRECTORY": "./rules",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Using with uvx (Python Package Manager)

If you publish this as a Python package, users can run it with:

```json
{
  "mcpServers": {
    "agent-rules": {
      "command": "uvx",
      "args": ["agent-rules-mcp@latest"],
      "env": {
        "RULES_DIRECTORY": "./rules"
      }
    }
  }
}
```

## Environment Variables

Configure the server using these environment variables:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `RULES_DIRECTORY` | Path to the rules directory | `"./rules"` | `"/path/to/rules"` |
| `LOG_LEVEL` | Logging level | `"info"` | `"debug"`, `"warn"`, `"error"` |
| `MAX_FILE_SIZE` | Maximum rule file size in bytes | `1048576` (1MB) | `2097152` (2MB) |
| `CACHE_TTL` | Cache time-to-live in seconds | `0` (no TTL) | `300` (5 minutes) |

### Setting Environment Variables

**Linux/macOS:**
```bash
export RULES_DIRECTORY="/path/to/my/rules"
export LOG_LEVEL="debug"
npm start
```

**Windows:**
```cmd
set RULES_DIRECTORY=C:\path\to\my\rules
set LOG_LEVEL=debug
npm start
```

**Using .env file:**
Create a `.env` file in the project root:
```env
RULES_DIRECTORY=./rules
LOG_LEVEL=info
MAX_FILE_SIZE=1048576
```

## Contributing

We welcome contributions! Here's how to add new rule domains:

### Adding New Rules

1. **Fork the repository** and create a new branch
2. **Create a new rule file** in the `rules/` directory:
   ```bash
   touch rules/your-domain.md
   ```
3. **Follow the rule file format** (see above)
4. **Test your rules** locally:
   ```bash
   npm run dev
   # Test with your MCP client
   ```
5. **Submit a pull request** with your changes

### Contribution Guidelines

- **Clear Domain Names**: Use descriptive, kebab-case filenames
- **Complete Metadata**: Include description and last updated date
- **Quality Content**: Provide actionable, well-organized rules
- **Test Locally**: Verify your rules work with the MCP server
- **Follow Format**: Use the standard markdown structure

### Example Contribution

```markdown
# Python Best Practices

- Last Updated: 2025-01-26
- Description: Python development best practices and conventions
- Version: 1.0

## Code Style

### PEP 8 Compliance
- Use 4 spaces for indentation
- Limit lines to 79 characters
- Use snake_case for variables and functions

### Type Hints
- Always use type hints for function parameters and return values
- Use `typing` module for complex types
```

## Troubleshooting

### Common Issues

**Server won't start:**
- Check that Node.js version is 18.0.0 or higher
- Verify all dependencies are installed: `npm install`
- Check that the rules directory exists and is readable

**Rules not loading:**
- Verify rule files are in the correct directory
- Check file permissions are readable
- Ensure markdown files have `.md` extension
- Check server logs for parsing errors

**MCP client connection issues:**
- Verify the server is running on the expected port
- Check MCP client configuration matches server setup
- Ensure environment variables are set correctly

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
LOG_LEVEL=debug npm start
```

This will show detailed information about:
- Rule file loading and parsing
- MCP tool invocations
- Error conditions and stack traces

## Architecture

The server follows a simple, file-based architecture:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│  MCP Server      │───▶│  Rule Manager   │
│                 │    │  (2 tools only) │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ Repository      │
                                               │ File Reader     │
                                               └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │ rules/          │
                                               │ ├── react.md    │
                                               │ ├── security.md │
                                               │ └── ...         │
                                               └─────────────────┘
```

## License

MIT License - see LICENSE file for details.

## Support

- **Issues**: Report bugs and feature requests on GitHub Issues
- **Discussions**: Join community discussions on GitHub Discussions
- **Documentation**: Check this README and inline code documentation