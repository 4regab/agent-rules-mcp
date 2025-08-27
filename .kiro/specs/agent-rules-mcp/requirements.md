# Requirements Document

## Introduction

This feature involves building a Node.js Model Context Protocol (MCP) server called "agent-rules-mcp" that provides development rules and best practices from local markdown files. The server will dynamically load rules from the `rules/` directory and expose them through MCP tools, similar to Context7's approach but using our own local rule files instead of an external database. The server will provide two main tools: `get_rules(domain)` for retrieving specific rule domains and `list_rules()` for discovering available domains.

## Requirements

### Requirement 1

**User Story:** As an AI agent or developer, I want to call `get_rules(domain)` to retrieve specific rule domains, so that I can get targeted guidance for my current development context.

#### Acceptance Criteria

2. WHEN a user calls `get_rules("security")` THEN the system SHALL return the contents of `rules/security.md` file  
3. WHEN a user calls `get_rules()` with a non-existent domain THEN the system SHALL return an appropriate error message
4. WHEN a user calls `get_rules()` with an invalid parameter THEN the system SHALL return a helpful error message

### Requirement 2

**User Story:** As an AI agent or developer, I want to call `list_rules()` to discover available rule domains, so that I can understand what guidance is available.

#### Acceptance Criteria

1. WHEN a user calls `list_rules()` THEN the system SHALL return a list of all available rule domains from the `rules/` directory
2. WHEN a user calls `list_rules()` THEN the system SHALL include descriptions for each domain extracted from the markdown files
3. WHEN the `rules/` directory is empty THEN the system SHALL return an empty list with an appropriate message
4. WHEN new rule files are added to the directory THEN the system SHALL automatically include them in the next `list_rules()` call

### Requirement 3

**User Story:** As a developer, I want the server to automatically detect and load rule files, so that I can add new rules without restarting the server.

#### Acceptance Criteria

1. WHEN a new markdown file is added to the `rules/` folder in my repository directory THEN the system SHALL automatically detect and load it
2. WHEN an existing rule file is modified THEN the system SHALL reload the updated content
3. WHEN a rule file is deleted THEN the system SHALL remove it from available domains
4. WHEN rule files contain invalid markdown format THEN the system SHALL log errors but continue operating with valid files

### Requirement 4

**User Story:** As a system administrator, I want the MCP server to be reliable and maintainable, so that it can run in production environments.

#### Acceptance Criteria

1. WHEN the server starts THEN it SHALL successfully load all valid rule files from the `rules/` directory
2. WHEN multiple clients connect simultaneously THEN the server SHALL handle concurrent requests without conflicts
3. WHEN errors occur THEN the server SHALL log appropriate error messages and continue operating
4. WHEN the server is configured THEN it SHALL support standard MCP server configuration options

### Requirement 5

**User Story:** As a developer, I want the server to follow the same simple interface pattern as Context7, so that it's easy to understand and use.

#### Acceptance Criteria

1. WHEN the server is implemented THEN it SHALL expose exactly two tools: `get_rules` and `list_rules`
2. WHEN the server loads rule files THEN it SHALL use the filename (without .md extension) as the domain name
3. WHEN rule files are structured THEN the server SHALL support standard markdown format with optional metadata sections
4. WHEN the server responds THEN it SHALL return clean, readable content suitable for AI agent consumption