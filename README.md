# Agent Rules MCP Server

MCP server that enables **agents to fetch coding rules** from your GitHub repository. Instead of cluttering your workspace with local rule files, you can now prompt AI agents to access the latest coding standards, best practices, and guidelines directly from your GitHub repository through natural language requests.

## Features

- **GitHub Integration**: Fetches rules from any GitHub repository 
- **Simple Setup**: Configure with environment variables, no local files needed
- **Dynamic Loading**: Automatically fetches latest rules from GitHub
- **Customizable**: Fork, customize, and contribute via GitHub
- **Secure**: GitHub API integration with optional token authentication
- **Configurable**: Support for custom repositories, branches, and paths
- **Community Rules**: Works with existing collections like [awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules)
- **Flexible Format**: Supports any markdown files (.md/.mdc) with or without metadata

## Quick Start with Awesome Cursor Rules

Get instant access to hundreds of community-maintained coding rules:

1. **Add to your MCP configuration:**
   ```json
   {
     "mcpServers": {
       "cursor-rules": {
         "command": "npx",
         "args": ["agent-rules-mcp@latest"],
         "env": {
           "GITHUB_OWNER": "PatrickJS",
           "GITHUB_REPO": "awesome-cursorrules",
           "GITHUB_PATH": "rules",
           "GITHUB_BRANCH": "main"
         }
       }
     }
   }
   ```

2. **Start using in your AI agent:**
   - "Apply the React rules"
   - "Show me the Python best practices"
   - "Get all available coding standards"

## MCP Client Configuration

Add this configuration to your MCP client (VS Code, Kiro, Cursor, Windsurf, etc.):

**Option A: Use Default Rules Collection**
```json
{
  "mcpServers": {
    "agent-rules": {
      "command": "npx",
      "args": ["agent-rules-mcp@latest"],
      "env": {
        "GITHUB_OWNER": "4regab",
        "GITHUB_REPO": "agent-rules-mcp",
        "GITHUB_PATH": "rules",
        "GITHUB_BRANCH": "master",
        "GITHUB_TOKEN": "ghp_your_personal_access_token"
      },
      "disabled": false
    }
  }
}
```

**Option B: Use Awesome Cursor Rules Collection**
```json
{
  "mcpServers": {
    "cursor-rules": {
      "command": "npx",
      "args": ["agent-rules-mcp@latest"],
      "env": {
        "GITHUB_OWNER": "PatrickJS",
        "GITHUB_REPO": "awesome-cursorrules",
        "GITHUB_PATH": "rules",
        "GITHUB_BRANCH": "main",
        "GITHUB_TOKEN": "ghp_your_personal_access_token"
      },
      "disabled": false
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
      "args": ["agent-rules-mcp@latest"],
      "env": {
        "GITHUB_OWNER": "your-username",
        "GITHUB_REPO": "your-rules-repo",
        "GITHUB_PATH": "your-rules-folder",
        "GITHUB_BRANCH": "main",
        "GITHUB_TOKEN": "ghp_your_personal_access_token"
      },
      "disabled": false
    }
  }
}
```

### GitHub Token (Highly Recommended)

While optional, a GitHub token is **highly recommended** to avoid rate limiting:

- **Without token**: 60 requests/hour per IP
- **With token**: 5,000 requests/hour per token

**Create a GitHub Personal Access Token:**

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `public_repo` (for public repos) or `repo` (for private repos)
4. Copy the token and set it as `GITHUB_TOKEN`

## Use Your Own Agent Rules

### Option 1: Fork the Default Repository

1. **Fork this repository** on GitHub
2. **Add your own rules** to the `rules/` directory
3. **Configure your MCP server settings env** to use your repository

### Option 2: Create Your Own Rules Repository

1. **Create a new GitHub repository** (public or private)
2. **Create a rules directory** (or use any path you prefer)
3. **Add your rule files** following the format above
4. **Configure the MCP server** to use your repository

### Option 3: Use Existing Rule Collections

You can point the MCP server to any existing GitHub repository with markdown rules, such as the excellent [awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) collection:

```json
{
  "mcpServers": {
    "cursor-rules": {
      "command": "npx",
      "args": ["agent-rules-mcp@latest"],
      "env": {
        "GITHUB_OWNER": "PatrickJS",
        "GITHUB_REPO": "awesome-cursorrules",
        "GITHUB_PATH": "rules",
        "GITHUB_BRANCH": "main",
        "GITHUB_TOKEN": "ghp_your_personal_access_token"
      },
      "disabled": false
    }
  }
}
```

**Other popular rule repositories you can use:**
- [awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules/tree/main/rules) - Comprehensive collection of Cursor IDE rules
- Any documentation repository with markdown files
- Your team's existing coding standards repository
- Open source project style guides

**Benefits of using existing collections:**
- ✅ **Instant access** to hundreds of pre-written rules
- ✅ **Community maintained** and regularly updated
- ✅ **No setup required** - just point and use
- ✅ **Flexible parsing** works with any markdown structure

**Example repository structure:**

```
my-coding-rules/
├── rules/
│   ├── python-style.md          # Standard markdown with metadata
│   ├── react-patterns.mdc       # MDC format supported
│   ├── security-checklist.md    # With YAML frontmatter
│   ├── api-design.md           # Simple markdown (no metadata required)
│   └── legacy-docs.md          # Any existing markdown works
├── README.md
└── .gitignore
```

## Contributing to the Default Repository

We welcome contributions to the default rule repository!

### Contribution Guidelines

- **Clear Domain Names**: Use descriptive, kebab-case filenames
- **Complete Metadata**: Include description and last updated date
- **Quality Content**: Provide actionable, well-organized rules with examples
- **Test Locally**: Verify your rules work with the MCP server
- **Follow Format**: Use standard markdown structure

### File Format Support

The MCP server supports both `.md` and `.mdc` markdown files with flexible structure:

**Recommended Structure (for optimal metadata extraction):**

```markdown
# Title of the coding rules

- Last Updated: YYYY-MM-DD
- Description: Brief description of the rules (used in list_rules() responses)
- Version: X.X (optional, for tracking major changes)

## Instructions
```

**Alternative: YAML Frontmatter:**

```markdown
---
description: Brief description of the rules
last_updated: YYYY-MM-DD
version: 1.0
---

# Title of the coding rules

## Instructions
```

**Flexible Support:**

The server also works with any markdown file, even without specific metadata. If no description is provided, it will:
- Extract the first heading as a title
- Use the first paragraph as a description
- Generate a fallback description based on the filename

This means you can use any existing markdown documentation as rules without modification.

## How It Helps

### On-Demand Rule Access for AI Agents

This MCP server eliminates the need for local rule files in your workspace. Instead of copying coding standards into each project, developers can now **prompt AI agents to fetch specific coding rules on-demand** from centralized GitHub repositories.

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
→ Agent automatically fetches latest React rules from GitHub
→ Agent applies rules without you managing local files

# Example with awesome-cursorrules:
"Apply the Next.js rules from awesome-cursorrules"
→ Agent fetches specific rules from PatrickJS/awesome-cursorrules
→ Instant access to community-maintained best practices
```

## License

MIT License - see LICENSE file for details.

## Support

- **Issues**: Report bugs and feature requests on GitHub Issues
- **Documentation**: Check this README and inline code documentation
