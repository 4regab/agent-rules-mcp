# Contributing to Agent Rules MCP Server

Thank you for your interest in contributing to the Agent Rules MCP Server! This document provides guidelines for contributing new rule domains, improving existing rules, and enhancing the server functionality.

## Table of Contents

- [Getting Started](#getting-started)
- [Contributing Rules](#contributing-rules)
- [Rule File Format](#rule-file-format)
- [Quality Guidelines](#quality-guidelines)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Code of Conduct](#code-of-conduct)

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

- **Programming Languages**: Python, Java, Go, Rust, C#, PHP
- **Frameworks**: Vue.js, Angular, Django, Spring Boot, Laravel
- **Databases**: PostgreSQL, MongoDB, Redis, MySQL
- **Cloud Platforms**: AWS, Azure, Google Cloud
- **DevOps**: Docker, Kubernetes, CI/CD, Infrastructure as Code
- **Mobile Development**: React Native, Flutter, iOS, Android
- **Testing**: Unit testing, Integration testing, E2E testing
- **Architecture**: Microservices, Event-driven architecture, Clean architecture

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

## Section 1

### Subsection 1.1

Content with examples, code snippets, and explanations.

### Subsection 1.2

More content...

## Section 2

Additional sections as needed...
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

### Example Rule File

````markdown
# Python Best Practices

- Last Updated: 2025-01-26
- Description: Python development best practices and coding standards
- Version: 1.0

## Code Style

### PEP 8 Compliance

Follow PEP 8 style guidelines for consistent code formatting:

```python
# Good: Clear, PEP 8 compliant
def calculate_total_price(items: list[dict], tax_rate: float) -> float:
    """Calculate total price including tax for a list of items."""
    subtotal = sum(item['price'] * item['quantity'] for item in items)
    return subtotal * (1 + tax_rate)

# Bad: Poor formatting and naming
def calc(x,y):
    return x*y
```
````

### Type Hints

Always use type hints for function parameters and return values:

```python
from typing import Optional, List, Dict

def process_user_data(
    user_id: int,
    data: Dict[str, Any],
    options: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Process user data with optional configuration."""
    # Implementation here
    pass
```

## Error Handling

### Exception Handling

Use specific exception types and provide meaningful error messages:

```python
# Good: Specific exception handling
try:
    user = get_user_by_id(user_id)
except UserNotFoundError as e:
    logger.error(f"User {user_id} not found: {e}")
    raise HTTPException(status_code=404, detail="User not found")
except DatabaseError as e:
    logger.error(f"Database error: {e}")
    raise HTTPException(status_code=500, detail="Internal server error")

# Bad: Catching all exceptions
try:
    user = get_user_by_id(user_id)
except Exception as e:
    print(f"Error: {e}")
```

````

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

## Development Setup

### Local Development

1. **Start the server in development mode**:
   ```bash
   npm run dev
````

2. **Test your rules**:

   ```bash
   # In another terminal, test the MCP tools
   npm test
   ```

3. **Validate rule files**:
   ```bash
   # Check that your rule files are properly formatted
   npm run validate-rules
   ```

### Testing Your Rules

Before submitting, test your rules:

1. **Server Integration**: Ensure the server can load your rule files
2. **MCP Tools**: Test with `get_rules("your-domain")` and `list_rules()`
3. **Content Review**: Have someone else review your rules for clarity

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- rule-manager.test.ts
```

### Adding Tests

If you're modifying server functionality, add appropriate tests:

```typescript
// tests/rules/your-domain.test.ts
describe("Your Domain Rules", () => {
  it("should load your domain rules correctly", async () => {
    const ruleManager = new RuleManager();
    const content = await ruleManager.getRuleContent("your-domain");

    expect(content).toBeDefined();
    expect(content.domain).toBe("your-domain");
    expect(content.content).toContain("# Your Domain Rules");
  });
});
```

## Pull Request Process

### Before Submitting

1. **Test Locally**: Ensure your changes work correctly
2. **Run Tests**: All tests must pass
3. **Check Formatting**: Follow the established patterns
4. **Update Documentation**: Update README if needed

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

## Rule Domain(s) Added/Modified

- domain-name.md

## Testing

- [ ] Tested locally with MCP client
- [ ] All existing tests pass
- [ ] Added new tests if applicable

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

## Recognition

Contributors will be recognized in:

- The project README
- Release notes for significant contributions
- GitHub contributor statistics

Thank you for contributing to the Agent Rules MCP Server! Your contributions help make development better for everyone.
