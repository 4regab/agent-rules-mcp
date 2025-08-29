---
inclusion: manual
---

# Agent Rules MCP Server - Project Overview

This project is an MCP (Model Context Protocol) server that enables AI agents to fetch coding rules on-demand from GitHub repositories. The server eliminates the need for local rule files by allowing agents to retrieve specific coding standards from remote repositories.

## Key Project Details

- **Package Name**: agent-rules-mcp
- **Version**: 1.3.0
- **Main Entry**: dist/index.js
- **Type**: ES Module
- **Node Version**: >=18.0.0
- **License**: MIT

## Core Functionality

The server provides two main tools:
- `get_rules`: Retrieves rule content for one or multiple domains
- `list_rules`: Lists all available rule domains with descriptions

## Architecture

- **Language**: TypeScript
- **Build System**: TypeScript compiler with separate dev/prod configs
- **Testing**: Vitest with coverage support
- **Development**: tsx for TypeScript execution
- **Distribution**: NPM package with binary executable

## Repository Structure

- `src/` - TypeScript source code
- `dist/` - Compiled JavaScript output
- `rules/` - Default rule collection
- `docs/` - Documentation files
- Configuration files for TypeScript, build, and package management

## Environment Configuration

The server uses environment variables for GitHub integration:
- `GITHUB_OWNER` - Repository owner
- `GITHUB_REPO` - Repository name  
- `GITHUB_PATH` - Path to rules folder
- `GITHUB_BRANCH` - Branch to fetch from

## Supported File Formats

- `.md` - Standard markdown
- `.mdc` - MDC (Markdown Components)
- `.chatmode.md` - AI assistant modes
- `.prompt.md` - Prompt templates
- `.instructions.md` - Coding instructions