[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/4regab-agent-rules-mcp-badge.png)](https://mseep.ai/app/4regab-agent-rules-mcp)

# Agent Rules MCP Server

[![MCP Server](https://badge.mcpx.dev?type=server)](https://modelcontextprotocol.io/)
[![NPM Version](https://img.shields.io/npm/v/agent-rules-mcp?style=flat-square&logo=npm)](https://www.npmjs.com/package/agent-rules-mcp)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

This MCP server eliminates the need for local rule files in your workspace. Instead of copying coding standards into each project, you can now **prompt AI agents to fetch specific coding rules** or all your rules from any rules folder on a public repository or your own.

## Features

- **GitHub Integration**: Fetches rules from any GitHub repository 
- **Simple Setup**: Configure with environment variables, no local files needed
- **Configurable**: Support for custom repositories, branches, and paths
- **Community Rules**: Works with existing collections like [awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) and [awesome-copilot](https://github.com/github/awesome-copilot), etc.
- **Compound Extensions**: Supports .chatmode.md, .prompt.md, .instructions.md files
- **Flexible Format**: Supports any markdown files (.md/.mdc) with or without metadata

## MCP Client Configuration (default)

Add this configuration to your MCP client (VS Code, Kiro, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "agent-rules": {
      "command": "npx",
      "args": ["-y","agent-rules-mcp@latest"],
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

## **Example Use of Community Rules Collections**

### GitHub Awesome Copilot Collection 

Get instant access to community-maintained coding rules:

```json
{
  "mcpServers": {
    "agent-rules": {
      "command": "npx",
      "args": ["-y","agent-rules-mcp@latest"],
      "env": {
        "GITHUB_OWNER": "github",
        "GITHUB_REPO": "awesome-copilot",         
        "GITHUB_PATH": "instructions",
        "GITHUB_BRANCH": "main"
      },
      "disabled": false
    }
  }
}
```
### Awesome Cursor Rules Collection

Alternative collection for cursor-specific rules:

```json
{
  "mcpServers": {
    "agent-rules": {
      "command": "npx",
      "args": ["-y","agent-rules-mcp@latest"],
      "env": {
         "GITHUB_OWNER": "PatrickJS",
         "GITHUB_REPO": "awesome-cursorrules",
         "GITHUB_PATH": "rules-new",
         "GITHUB_BRANCH": "main"
         }
       }
     }
   }
```

## Available Tools

-  `get_rules`: Retrieves rule content for one or multiple domains from the GitHub repository rules folder.
-  `list_rules`: Lists all available rule domains with descriptions.

### Using Your Own Rules Folder Repository  (Recommended)

To use your own GitHub repository instead of the default:

```json
{
  "mcpServers": {
    "agentrules": {
      "command": "npx",
      "args": ["-y","agent-rules-mcp@latest"],
      "env": {
        "GITHUB_OWNER": "your-username",
        "GITHUB_REPO": "your-rules-repo",
        "GITHUB_PATH": "your-rules-folder",
        "GITHUB_BRANCH": "main"
      },
      "disabled": false
    }
  }
}
```

**Example repository structure:**

```
my-coding-rules/
├── rules/                       # Traditional single directory
│   ├── python-style.md          # Standard markdown with metadata
│   ├── react-patterns.mdc       # MDC format supported
│   └── security-checklist.md    # With YAML frontmatter
├── README.md
└── .gitignore
```

## How This Helps

### On-Demand Rule Access for AI Agents

**Before (Traditional Approach):**

```
my-project/
├──rules                  ← Local rule files needed
│   ├── react-rules.md
│   ├── security-rules.md
│   └── typescript-rules.md
├── src/
└── package.json
```

**After (agent-rules MCP Approach):**

```
my-project/
├── src/
└── package.json          ← Clean workspace, no local rules needed

# In Coding Agent:
"Apply React best practices to this component"
→ Agent automatically fetches React rules from your rules folder
```

### **Flexible Support & File Format Compatibility**

The server works with various file formats and naming conventions:

**Supported Extensions:**
- `.md` - Standard markdown files
- `.mdc` - MDC (Markdown Components) files  
- `.chatmode.md` - AI assistant mode definitions
- `.prompt.md` - Prompt templates
- `.instructions.md` - Coding instruction files

**Automatic Metadata Extraction:**
If no explicit metadata is provided, the server will:
- Extract the first heading as a title
- Use the first paragraph as a description  
- Generate a fallback description based on the filename
- Parse YAML frontmatter when available

**Domain Name Handling:**
- `accessibility.chatmode.md` → domain: `accessibility`
- `react-best-practices.instructions.md` → domain: `react-best-practices`
- `4.1-Beast.chatmode.md` → domain: `4.1-Beast` (supports dots and special chars)

This means you can use any existing markdown documentation as rules without modification.

## Contributing

We welcome contributions to the default rule repository!

- **Clear Domain Names**: Use descriptive, kebab-case filenames
- **Complete Metadata**: Include description and last updated date
- **Quality Content**: Provide actionable, well-organized rules with examples
- **Test Locally**: Verify your rules work with the MCP server
- **Follow Format**: Use standard markdown structure

**Recommended Structure (for optimal metadata extraction):**

```markdown
# Title of the coding rules

- Last Updated: YYYY-MM-DD
- Description: Brief description of the rules (used in list_rules() responses)
- Version: X.X (optional, for tracking major changes)

## Content 
```
Made with [Kiro](https://kiro.devpost.com/) for [Code-with-kiro-hackathon](https://kiro.devpost.com/).
## License

MIT License - see LICENSE file for details.

## Support

- **Issues**: Report bugs and feature requests on GitHub Issues
- **Documentation**: Check this README and inline code documentation
