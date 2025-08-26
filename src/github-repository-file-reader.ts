/**
 * Interface for rule content with metadata
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
 * Provides methods to read specific files, list available files, and check existence
 */
export class GitHubRepositoryFileReader {
  private owner: string;
  private repo: string;
  private path: string;
  private branch: string;
  private baseUrl: string;
  private token?: string;

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
   * @param domain - The domain name (filename without .md extension)
   * @returns Promise<string> - The file content
   * @throws Error if file doesn't exist or can't be read
   */
  async readRuleFile(domain: string): Promise<string> {
    try {
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${this.path}/${domain}.md?ref=${this.branch}`;
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'agent-rules-mcp'
      };
      
      // Add GitHub token if available for higher rate limits
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Rule file not found for domain: ${domain}`);
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      if (data.type !== 'file') {
        throw new Error(`Expected file but got ${data.type} for domain: ${domain}`);
      }

      // Decode base64 content
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return content;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to read rule file for domain ${domain}: ${error}`);
    }
  }

  /**
   * List all available rule files in the GitHub repository
   * @returns Promise<string[]> - Array of domain names (filenames without .md extension)
   */
  async listRuleFiles(): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${this.path}?ref=${this.branch}`;
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'agent-rules-mcp'
      };
      
      // Add GitHub token if available for higher rate limits
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Rules directory not found: ${this.path}`);
          return [];
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any[];
      
      if (!Array.isArray(data)) {
        throw new Error('Expected directory listing but got single file');
      }

      const validDomains: string[] = [];
      
      for (const item of data) {
        if (item.type !== 'file' || !item.name.endsWith('.md')) {
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
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to list rule files: ${error}`);
    }
  }

  /**
   * Check if a rule file exists for the given domain
   * @param domain - The domain name to check
   * @returns Promise<boolean> - True if file exists, false otherwise
   */
  async ruleExists(domain: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${this.path}/${domain}.md?ref=${this.branch}`;
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'agent-rules-mcp'
      };
      
      // Add GitHub token if available for higher rate limits
      if (this.token) {
        headers['Authorization'] = `token ${this.token}`;
      }
      
      const response = await fetch(url, { headers });
      return response.ok;
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

      return ruleContent;
    } catch (error) {
      console.error(`Error parsing markdown for domain ${domain}:`, error instanceof Error ? error.message : error);
      
      return {
        domain,
        content: content.trim(),
        description: `Rules for ${domain} (parsing error - metadata unavailable)`
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
    return filename;
  }

  /**
   * Validate domain name format
   */
  isValidDomain(domain: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(domain) && domain.length > 0;
  }

  /**
   * Get the repository information
   */
  getRepositoryInfo(): string {
    return `${this.owner}/${this.repo}/${this.path} (branch: ${this.branch})`;
  }
}