/**
 * Interface for rule content with metadata
 * Supports both .md and .mdc files with flexible metadata parsing
 */
export interface RuleContent {
  domain: string;
  content: string;
  description?: string;
  lastUpdated?: string;
  version?: string;
}

/**
 * Interface for domain information
 */
export interface DomainInfo {
  domain: string;
  description: string;
  lastUpdated?: string;
}

/**
 * GitHubRepositoryFileReader handles reading rule files from a GitHub repository
 * Supports both .md and .mdc files with flexible metadata parsing
 * Provides methods to read specific files, list available files, and check existence
 */
export class GitHubRepositoryFileReader {
  private owner: string;
  private repo: string;
  private path: string;
  private branch: string;
  private baseUrl: string;
  private token?: string;

  // Rate limit aware caching
  private directoryCache: { data: any[], timestamp: number } | null = null;
  private readonly DIRECTORY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for directory listing
  private rateLimitResetTime: number = 0;

  // Fallback domain list for when API is rate limited
  private readonly FALLBACK_DOMAINS = [
    'clean-code', 'fastapi', 'nextjs-tailwind', 'node-express',
    'performance-optimization', 'react', 'security', 'silent-behavior',
    'tailwind', 'tasksync', 'typescript', 'vite'
  ];

  constructor(
    owner?: string,
    repo?: string,
    path?: string,
    branch?: string
  ) {
    // Use environment variables with generic defaults
    this.owner = owner || process.env.GITHUB_OWNER || '';
    this.repo = repo || process.env.GITHUB_REPO || '';
    this.path = path || process.env.GITHUB_PATH || '';
    this.branch = branch || process.env.GITHUB_BRANCH || '';
    this.baseUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
    this.token = process.env.GITHUB_TOKEN;

    // Validate required configuration
    if (!this.owner) {
      throw new Error('GITHUB_OWNER environment variable is required');
    }
    if (!this.repo) {
      throw new Error('GITHUB_REPO environment variable is required');
    }
  }

  /**
   * Read a specific rule file by domain name from GitHub
   * @param domain - The domain name (filename without .md/.mdc extension)
   * @returns Promise<string> - The file content
   * @throws Error if file doesn't exist or can't be read
   */
  async readRuleFile(domain: string): Promise<string> {
    try {
      // Check if we're currently rate limited, try fallback method first
      if (this.rateLimitResetTime > Date.now()) {
        return await this.readRuleFileViaRawUrl(domain);
      }

      // Try both .md and .mdc extensions
      const extensions = ['.md', '.mdc'];
      let lastError: Error | null = null;

      for (const ext of extensions) {
        try {
          const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${this.path}/${domain}${ext}?ref=${this.branch}`;
          const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'agent-rules-mcp'
          };

          // Add GitHub token if available for higher rate limits
          if (this.token) {
            headers['Authorization'] = `token ${this.token}`;
          }

          const response = await fetch(url, { headers });

          // Update rate limit tracking
          const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
          const rateLimitReset = response.headers.get('x-ratelimit-reset');

          if (rateLimitReset) {
            this.rateLimitResetTime = parseInt(rateLimitReset) * 1000; // Convert to milliseconds
          }

          if (response.ok) {
            const data = await response.json() as any;

            if (data.type !== 'file') {
              throw new Error(`Expected file but got ${data.type} for domain: ${domain}`);
            }

            // Decode base64 content
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            return content;
          } else if (response.status !== 404) {
            if (response.status === 403 || response.status === 429) {
              // Try fallback method when rate limited
              return await this.readRuleFileViaRawUrl(domain);
            }
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          // If this was a rate limit error, try fallback
          if (lastError.message.includes('rate limit')) {
            try {
              return await this.readRuleFileViaRawUrl(domain);
            } catch (fallbackError) {
              // Continue to next extension or fail
            }
          }
        }
      }

      // If we get here, neither extension worked
      throw new Error(`Rule file not found for domain: ${domain} (tried .md and .mdc extensions)`);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to read rule file for domain ${domain}: ${error}`);
    }
  }

  /**
   * Fallback method to read rule files using raw GitHub URLs
   * This has different rate limits and doesn't require API authentication
   */
  private async readRuleFileViaRawUrl(domain: string): Promise<string> {
    const extensions = ['.md', '.mdc'];
    let lastError: Error | null = null;

    for (const ext of extensions) {
      try {
        // Use raw.githubusercontent.com which has different rate limits
        const rawUrl = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${this.path}/${domain}${ext}`;

        const response = await fetch(rawUrl, {
          headers: {
            'User-Agent': 'agent-rules-mcp'
          }
        });

        if (response.ok) {
          const content = await response.text();
          return content;
        } else if (response.status !== 404) {
          throw new Error(`Raw GitHub error: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw new Error(`Rule file not found for domain: ${domain} via raw URL (tried .md and .mdc extensions)`);
  }

  /**
   * List all available rule files in the GitHub repository
   * @returns Promise<string[]> - Array of domain names (filenames without .md/.mdc extension)
   */
  async listRuleFiles(): Promise<string[]> {
    try {
      // Check if we have cached directory data that's still valid
      if (this.directoryCache && (Date.now() - this.directoryCache.timestamp) < this.DIRECTORY_CACHE_TTL) {
        return this.extractDomainsFromDirectoryData(this.directoryCache.data);
      }

      // Check if we're currently rate limited
      if (this.rateLimitResetTime > Date.now()) {
        // If we have any cached data, use it even if expired
        if (this.directoryCache) {
          return this.extractDomainsFromDirectoryData(this.directoryCache.data);
        }

        // Use fallback domain list when rate limited and no cache available
        return this.FALLBACK_DOMAINS;
      }

      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${this.path}?ref=${this.branch}`;
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'agent-rules-mcp'
      };

      // Add GitHub token if available for higher rate limits
      const hasToken = !!this.token;
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }

      const response = await fetch(url, { headers });

      // Update rate limit tracking
      const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
      const rateLimitReset = response.headers.get('x-ratelimit-reset');

      if (rateLimitReset) {
        this.rateLimitResetTime = parseInt(rateLimitReset) * 1000; // Convert to milliseconds
      }

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Rules directory not found: ${this.path}`);
          return [];
        }
        if (response.status === 403 || response.status === 429) {
          // If we have cached data, use it
          if (this.directoryCache) {
            return this.extractDomainsFromDirectoryData(this.directoryCache.data);
          }

          // Use fallback domain list when rate limited
          return this.FALLBACK_DOMAINS;
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any[];

      if (!Array.isArray(data)) {
        throw new Error('Expected directory listing but got single file');
      }

      // Cache the directory data
      this.directoryCache = {
        data: data,
        timestamp: Date.now()
      };

      return this.extractDomainsFromDirectoryData(data);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to list rule files: ${error}`);
    }
  }

  /**
   * Extract domain names from directory data
   */
  private extractDomainsFromDirectoryData(data: any[]): string[] {
    const validDomains: string[] = [];

    for (const item of data) {
      if (item.type !== 'file' || !(item.name.endsWith('.md') || item.name.endsWith('.mdc'))) {
        continue;
      }

      const domain = this.extractDomainFromFilename(item.name);

      // Validate domain name format
      if (!this.isValidDomain(domain)) {
        console.warn(`Skipping invalid domain name: ${domain} (from file: ${item.name})`);
        continue;
      }

      validDomains.push(domain);
    }

    return validDomains;
  }

  /**
   * Check if a rule file exists for the given domain
   * @param domain - The domain name to check
   * @returns Promise<boolean> - True if file exists, false otherwise
   */
  async ruleExists(domain: string): Promise<boolean> {
    try {
      // Check both .md and .mdc extensions
      const extensions = ['.md', '.mdc'];

      for (const ext of extensions) {
        const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${this.path}/${domain}${ext}?ref=${this.branch}`;
        const headers: Record<string, string> = {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'agent-rules-mcp'
        };

        // Add GitHub token if available for higher rate limits
        if (this.token) {
          headers['Authorization'] = `token ${this.token}`;
        }

        const response = await fetch(url, { headers });
        if (response.ok) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Parse rule content and extract metadata from markdown
   * @param content - Raw markdown content
   * @param domain - Domain name for the rule
   * @returns RuleContent - Parsed content with metadata
   */
  parseRuleContent(content: string, domain: string): RuleContent {
    try {
      const ruleContent: RuleContent = {
        domain,
        content: content.trim()
      };

      // First try to parse YAML frontmatter (between --- delimiters)
      const frontmatterMatch = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const mainContent = frontmatterMatch[2];

        // Parse YAML-style frontmatter
        this.parseFrontmatter(frontmatter, ruleContent);
        ruleContent.content = mainContent.trim();
      } else {
        // Fall back to inline metadata parsing
        this.parseInlineMetadata(content, ruleContent);
      }

      // If no description was found, generate one from the content
      if (!ruleContent.description) {
        ruleContent.description = this.generateDescriptionFromContent(content, domain);
      }

      return ruleContent;
    } catch (error) {
      console.error(`Error parsing markdown for domain ${domain}:`, error instanceof Error ? error.message : error);

      return {
        domain,
        content: content.trim(),
        description: this.generateDescriptionFromContent(content, domain)
      };
    }
  }

  /**
   * Parse YAML-style frontmatter
   */
  private parseFrontmatter(frontmatter: string, ruleContent: RuleContent): void {
    const lines = frontmatter.split(/\r?\n/);

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmedLine.substring(0, colonIndex).trim().toLowerCase();
      const value = trimmedLine.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');

      switch (key) {
        case 'description':
          ruleContent.description = value;
          break;
        case 'last_updated':
        case 'lastupdated':
        case 'updated':
          ruleContent.lastUpdated = value;
          break;
        case 'version':
          ruleContent.version = value;
          break;
      }
    }
  }

  /**
   * Parse inline metadata
   */
  private parseInlineMetadata(content: string, ruleContent: RuleContent): void {
    const descriptionMatch = content.match(/(?:^|\r?\n)\s*-\s*Description:\s*(.+?)(?:\r?\n|$)/i);
    if (descriptionMatch) {
      ruleContent.description = descriptionMatch[1].trim();
    }

    const lastUpdatedMatch = content.match(/(?:^|\r?\n)\s*-\s*Last Updated:\s*(.+?)(?:\r?\n|$)/i);
    if (lastUpdatedMatch) {
      ruleContent.lastUpdated = lastUpdatedMatch[1].trim();
    }

    const versionMatch = content.match(/(?:^|\r?\n)\s*-\s*Version:\s*(.+?)(?:\r?\n|$)/i);
    if (versionMatch) {
      ruleContent.version = versionMatch[1].trim();
    }
  }

  /**
   * Extract domain name from filename
   */
  extractDomainFromFilename(filename: string): string {
    if (filename.endsWith('.md')) {
      return filename.slice(0, -3);
    }
    if (filename.endsWith('.mdc')) {
      return filename.slice(0, -4);
    }
    return filename;
  }

  /**
   * Validate domain name format
   */
  isValidDomain(domain: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(domain) && domain.length > 0;
  }

  /**
   * Generate a description from the content when no explicit description is found
   */
  private generateDescriptionFromContent(content: string, domain: string): string {
    try {
      // Try to extract the first heading as a title/description
      const headingMatch = content.match(/^#\s+(.+?)(?:\r?\n|$)/m);
      if (headingMatch) {
        const title = headingMatch[1].trim();
        // If the title is different from the domain, use it as description
        if (title.toLowerCase() !== domain.toLowerCase()) {
          return title;
        }
      }

      // Try to find the first paragraph after headings
      const paragraphMatch = content.match(/(?:^|\r?\n)(?!#)([^\r\n]+(?:\r?\n(?!#)[^\r\n]+)*)/m);
      if (paragraphMatch) {
        const paragraph = paragraphMatch[1].trim();
        // Take first sentence or first 100 characters
        const firstSentence = paragraph.split(/[.!?]/)[0];
        if (firstSentence && firstSentence.length > 10) {
          return firstSentence.trim() + (firstSentence.length < paragraph.length ? '...' : '');
        }
      }

      // Fallback: generate description based on domain name
      return `Development rules and guidelines for ${domain.replace(/[-_]/g, ' ')}`;
    } catch (error) {
      // Ultimate fallback
      return `Rules for ${domain}`;
    }
  }

  /**
   * Check if authentication token is available
   */
  hasAuthToken(): boolean {
    return !!this.token;
  }

  /**
   * Get the repository information
   */
  getRepositoryInfo(): string {
    return `${this.owner}/${this.repo}/${this.path} (branch: ${this.branch})`;
  }
}