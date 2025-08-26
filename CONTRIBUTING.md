# Contributing to Agent Rules MCP Server

Thank you for your interest in contributing to the Agent Rules MCP Server! This document provides guidelines for contributing new rule domains, improving existing rules, and enhancing the server functionality.

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Git for version control
- Basic knowledge of Markdown

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/agent-rules-mcp.git
   cd agent-rules-mcp
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a new branch for your contribution:
   ```bash
   git checkout -b feature/add-python-rules
   ```

## Contributing Rules

### Types of Contributions

We welcome the following types of rule contributions:

1. **New Domain Rules**: Complete rule sets for new technologies or domains
2. **Rule Improvements**: Enhancements to existing rule files
3. **Best Practice Updates**: Updates reflecting current best practices
4. **Bug Fixes**: Corrections to existing rules or examples

### Popular Rule Domains Needed

We're particularly interested in rules for:

- **Programming Languages**
- **Frameworks**
- **Databases**
- **Cloud Platforms**
- **DevOps**
- **Mobile Development**
- **Testing**
- **Architecture**

## Rule File Format

### File Naming Convention

- Use kebab-case for filenames: `python-best-practices.md`
- Be descriptive and specific: `react-testing.md` instead of `testing.md`
- Avoid spaces and special characters
- Use `.md` extension

### Required Structure

Every rule file must follow this structure:

```markdown
# Domain Name Rules

- Last Updated: YYYY-MM-DD
- Description: Brief description of the rules (used in list_rules() responses)
- Version: X.X (optional, for tracking major changes)

## Instructions
```

### Metadata Requirements

The metadata section at the top is crucial:

- **Last Updated**: Use YYYY-MM-DD format (e.g., 2025-01-26)
- **Description**: Keep it concise (under 100 characters) and descriptive
- **Version**: Optional, use semantic versioning (1.0, 1.1, 2.0)

### Content Guidelines

1. **Clear Structure**: Use proper heading hierarchy (##, ###, ####)
2. **Code Examples**: Include practical, working code examples
3. **Explanations**: Explain the "why" behind each rule
4. **Best Practices**: Focus on actionable guidance
5. **Current Standards**: Ensure rules reflect current best practices

## Quality Guidelines

### Content Quality Standards

1. **Accuracy**: All rules must be technically accurate and current
2. **Completeness**: Cover the essential aspects of the domain
3. **Clarity**: Use clear, concise language
4. **Examples**: Include practical, working code examples
5. **Organization**: Structure content logically with proper headings

### Code Example Standards

- **Working Code**: All code examples must be syntactically correct
- **Best Practices**: Examples should demonstrate best practices
- **Comments**: Include explanatory comments where helpful
- **Context**: Provide context for when to use each pattern

### Language and Style

- Use clear, professional language
- Write in present tense
- Use active voice when possible
- Be concise but thorough
- Include rationale for rules when helpful

## Pull Request Process

### Pull Request Template

When creating a pull request, include:

```markdown
## Description

Brief description of your changes

## Type of Change

- [ ] New rule domain
- [ ] Rule improvement/update
- [ ] Bug fix
- [ ] Documentation update
- [ ] Server enhancement
- [ ] Others

## Rule Domain(s) Added/Modified

- domain-name.md

## Checklist

- [ ] Followed rule file format
- [ ] Included proper metadata
- [ ] Used clear, descriptive examples
- [ ] Updated documentation if needed
```

### Review Process

1. **Automated Checks**: CI will run tests and validation
2. **Content Review**: Maintainers will review for quality and accuracy
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, your PR will be merged

### After Merge

- Your rules will be available in the next release
- Consider contributing to related domains
- Help review other contributors' PRs

## Code of Conduct

### Our Standards

- **Be Respectful**: Treat all contributors with respect
- **Be Constructive**: Provide helpful, constructive feedback
- **Be Collaborative**: Work together to improve the project
- **Be Patient**: Remember that everyone is learning

### Unacceptable Behavior

- Harassment or discrimination of any kind
- Trolling, insulting, or derogatory comments
- Publishing others' private information
- Any conduct that would be inappropriate in a professional setting

## Getting Help

### Questions and Support

- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check the README and this contributing guide

### Maintainer Contact

If you need direct help or have sensitive questions, contact the maintainers through GitHub.

Thank you for contributing to the Agent Rules MCP Server! Your contributions help make development better for everyone.

