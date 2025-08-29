---
inclusion: manual
---

# Deployment and Release Guidelines

## NPM Package Deployment

### Pre-Release Checklist
- Run full test suite: `npm run test`
- Verify TypeScript compilation: `npm run typecheck`
- Build production version: `npm run build:prod`
- Update version in package.json following semantic versioning
- Update CHANGELOG.md with release notes

### Release Process
1. Ensure all tests pass and build succeeds
2. Update version using `npm version [patch|minor|major]`
3. Push changes and tags to GitHub
4. Publish to NPM: `npm publish`
5. Create GitHub release with changelog

### Package Configuration
- Ensure `files` array includes all necessary distribution files
- Verify binary executable is properly configured
- Test package installation: `npm pack` and test locally
- Validate package.json metadata (keywords, description, etc.)

## GitHub Repository Management

### Branch Strategy
- Use `master` or `main` as primary branch
- Create feature branches for development
- Use pull requests for code review
- Tag releases appropriately

### Release Assets
- Include compiled distribution files
- Provide installation instructions
- Document breaking changes
- Include migration guides when necessary

## MCP Server Distribution

### NPX Distribution
- Ensure package works with `npx agent-rules-mcp@latest`
- Test installation on clean environments
- Verify all dependencies are properly declared
- Test with different Node.js versions (>=18.0.0)

### Docker Considerations (Future)
- Consider containerized deployment options
- Document environment variable requirements
- Provide docker-compose examples for development

## Monitoring and Maintenance

### Performance Monitoring
- Monitor GitHub API rate limit usage
- Track package download statistics
- Monitor error rates and common issues

### Security Updates
- Keep dependencies updated
- Monitor for security vulnerabilities
- Follow responsible disclosure for security issues

### Community Support
- Respond to GitHub issues promptly
- Maintain clear contribution guidelines
- Provide support for common configuration issues

## Environment-Specific Considerations

### Development Environment
- Use `npm run dev` for local development
- Configure environment variables for testing
- Use local GitHub repositories for testing when possible

### Production Environment
- Use stable package versions
- Configure appropriate logging levels
- Monitor resource usage and performance
- Implement proper error handling and recovery