export interface RuleContent {
  domain: string;
  content: string;
  description?: string;
  lastUpdated?: string;
  version?: string;
}

export interface DomainInfo {
  domain: string;
  description: string;
  lastUpdated?: string;
}

export class GitHubRepositoryFileReader {
  private owner: string;
  private repo: string;
  private path: string;
  private branch: string;
  private baseUrl: string;
  private token?: string;
  private directoryCache: { data: any[], timestamp: number } | null = null;
  private readonly DIRECTORY_CACHE_TTL = 10 * 60 * 1000;
  private rateLimitResetTime: number = 0;

  constructor(owner?: string, repo?: string, path?: string, branch?: string) {
    this.owner = owner || process.env.GITHUB_OWNER || '';
    this.repo = repo || process.env.GITHUB_REPO || '';
    this.path = path || process.env.GITHUB_PATH || '';
    this.branch = branch || process.env.GITHUB_BRANCH || '';
    this.baseUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
    this.token = process.env.GITHUB_TOKEN;

    if (!this.owner || !this.repo) throw new Error(`${!this.owner ? 'GITHUB_OWNER' : 'GITHUB_REPO'} environment variable is required`);
  }

  async readRuleFile(domain: string): Promise<string> {
    try {
      if (this.rateLimitResetTime > Date.now()) return await this.readRuleFileViaRawUrl(domain);

      const directories = this.path ? [this.path] : ['chatmodes', 'prompts', 'instructions'];
      const extensions = ['.chatmode.md', '.prompt.md', '.instructions.md', '.md', '.mdc'];

      for (const dir of directories) {
        for (const ext of extensions) {
          try {
            const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${dir}/${domain}${ext}?ref=${this.branch}`;
            const headers: Record<string, string> = {
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'agent-rules-mcp',
              ...(this.token && { 'Authorization': `token ${this.token}` })
            };

            const response = await fetch(url, { headers });
            const rateLimitReset = response.headers.get('x-ratelimit-reset');
            if (rateLimitReset) this.rateLimitResetTime = parseInt(rateLimitReset) * 1000;

            if (response.ok) {
              const data = await response.json() as any;
              if (data.type !== 'file') throw new Error(`Expected file but got ${data.type} for domain: ${domain}`);
              return Buffer.from(data.content, 'base64').toString('utf-8');
            } else if (response.status !== 404) {
              if (response.status === 403 || response.status === 429) return await this.readRuleFileViaRawUrl(domain);
              throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
          } catch (error) {
            if (error instanceof Error && error.message.includes('rate limit')) {
              try { return await this.readRuleFileViaRawUrl(domain); } catch { /* Continue to next combination */ }
            }
          }
        }
      }

      throw new Error(`Rule file not found for domain: ${domain} (searched in ${directories.join(', ')} with extensions ${extensions.join(', ')})`);
    } catch (error) {
      throw error instanceof Error ? error : new Error(`Failed to read rule file for domain ${domain}: ${error}`);
    }
  }

  private async readRuleFileViaRawUrl(domain: string): Promise<string> {
    const directories = this.path ? [this.path] : ['chatmodes', 'prompts', 'instructions'];
    const extensions = ['.chatmode.md', '.prompt.md', '.instructions.md', '.md', '.mdc'];

    for (const dir of directories) {
      for (const ext of extensions) {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${dir}/${domain}${ext}`;
          const response = await fetch(rawUrl, { headers: { 'User-Agent': 'agent-rules-mcp' } });

          if (response.ok) return await response.text();
          if (response.status !== 404) throw new Error(`Raw GitHub error: ${response.status} ${response.statusText}`);
        } catch (error) { /* Continue to next combination */ }
      }
    }

    throw new Error(`Rule file not found for domain: ${domain} via raw URL (searched in ${directories.join(', ')} with extensions ${extensions.join(', ')})`);
  }

  async listRuleFiles(): Promise<string[]> {
    try {
      if (this.directoryCache && (Date.now() - this.directoryCache.timestamp) < this.DIRECTORY_CACHE_TTL) {
        return this.extractDomainsFromDirectoryData(this.directoryCache.data);
      }

      if (this.rateLimitResetTime > Date.now()) {
        if (this.directoryCache) return this.extractDomainsFromDirectoryData(this.directoryCache.data);
        return [];
      }

      const directories = this.path ? [this.path] : ['chatmodes', 'prompts', 'instructions'];
      let allFiles: any[] = [];

      for (const dir of directories) {
        try {
          const dirFiles = await this.fetchDirectoryContents(dir);
          allFiles = allFiles.concat(dirFiles);
        } catch (error) { /* Continue with other directories even if one fails */ }
      }

      this.directoryCache = { data: allFiles, timestamp: Date.now() };
      return this.extractDomainsFromDirectoryData(allFiles);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(`Failed to list rule files: ${error}`);
    }
  }

  private async fetchDirectoryContents(directory: string): Promise<any[]> {
    const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${directory}?ref=${this.branch}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'agent-rules-mcp',
      ...(this.token && { 'Authorization': `token ${this.token}` })
    };

    const response = await fetch(url, { headers });
    const rateLimitReset = response.headers.get('x-ratelimit-reset');
    if (rateLimitReset) this.rateLimitResetTime = parseInt(rateLimitReset) * 1000;

    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`GitHub API error for ${directory}: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any[];
    return Array.isArray(data) ? data : [];
  }

  private extractDomainsFromDirectoryData(data: any[]): string[] {
    const seenDomains = new Set<string>();
    const validDomains: string[] = [];

    for (const item of data) {
      if (item.type !== 'file' || !this.isRuleFile(item.name)) continue;

      const domain = this.extractDomainFromFilename(item.name);
      if (seenDomains.has(domain) || !this.isValidDomain(domain)) continue;

      validDomains.push(domain);
      seenDomains.add(domain);
    }

    return validDomains;
  }

  private isRuleFile(filename: string): boolean {
    const skipFiles = ['README.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'SUPPORT.md', 'LICENSE.md'];
    if (skipFiles.includes(filename)) return false;

    const ruleExtensions = ['.chatmode.md', '.prompt.md', '.instructions.md'];
    return ruleExtensions.some(ext => filename.endsWith(ext)) ||
      (filename.endsWith('.md') && !filename.startsWith('README')) ||
      filename.endsWith('.mdc');
  }

  async ruleExists(domain: string): Promise<boolean> {
    try {
      const extensions = ['.md', '.mdc'];

      for (const ext of extensions) {
        const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/contents/${this.path}/${domain}${ext}?ref=${this.branch}`;
        const headers: Record<string, string> = {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'agent-rules-mcp',
          ...(this.token && { 'Authorization': `token ${this.token}` })
        };

        const response = await fetch(url, { headers });
        if (response.ok) return true;
      }

      return false;
    } catch { return false; }
  }

  parseRuleContent(content: string, domain: string): RuleContent {
    try {
      const ruleContent: RuleContent = { domain, content: content.trim() };

      const frontmatterMatch = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
      if (frontmatterMatch) {
        const [, frontmatter, mainContent] = frontmatterMatch;
        this.parseFrontmatter(frontmatter, ruleContent);
        ruleContent.content = mainContent.trim();
      } else {
        this.parseInlineMetadata(content, ruleContent);
      }

      if (!ruleContent.description) ruleContent.description = this.generateDescriptionFromContent(content, domain);

      return ruleContent;
    } catch (error) {
      console.error(`Error parsing markdown for domain ${domain}:`, error instanceof Error ? error.message : error);
      return { domain, content: content.trim(), description: this.generateDescriptionFromContent(content, domain) };
    }
  }

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
        case 'description': ruleContent.description = value; break;
        case 'last_updated': case 'lastupdated': case 'updated': ruleContent.lastUpdated = value; break;
        case 'version': ruleContent.version = value; break;
      }
    }
  }

  private parseInlineMetadata(content: string, ruleContent: RuleContent): void {
    const descriptionMatch = content.match(/(?:^|\r?\n)\s*-\s*Description:\s*(.+?)(?:\r?\n|$)/i);
    if (descriptionMatch) ruleContent.description = descriptionMatch[1].trim();

    const lastUpdatedMatch = content.match(/(?:^|\r?\n)\s*-\s*Last Updated:\s*(.+?)(?:\r?\n|$)/i);
    if (lastUpdatedMatch) ruleContent.lastUpdated = lastUpdatedMatch[1].trim();

    const versionMatch = content.match(/(?:^|\r?\n)\s*-\s*Version:\s*(.+?)(?:\r?\n|$)/i);
    if (versionMatch) ruleContent.version = versionMatch[1].trim();
  }

  extractDomainFromFilename(filename: string): string {
    if (filename.endsWith('.md')) {
      let baseName = filename.slice(0, -3);
      const compoundExtensions = ['.chatmode', '.prompt', '.instructions'];
      for (const ext of compoundExtensions) {
        if (baseName.endsWith(ext)) {
          baseName = baseName.slice(0, -ext.length);
          break;
        }
      }
      return baseName;
    }

    if (filename.endsWith('.mdc')) return filename.slice(0, -4);
    return filename;
  }

  isValidDomain(domain: string): boolean {
    return /^[a-zA-Z0-9._-]+$/.test(domain) && domain.length > 0;
  }

  private generateDescriptionFromContent(content: string, domain: string): string {
    try {
      const headingMatch = content.match(/^#\s+(.+?)(?:\r?\n|$)/m);
      if (headingMatch) {
        const title = headingMatch[1].trim();
        if (title.toLowerCase() !== domain.toLowerCase()) return title;
      }

      const paragraphMatch = content.match(/(?:^|\r?\n)(?!#)([^\r\n]+(?:\r?\n(?!#)[^\r\n]+)*)/m);
      if (paragraphMatch) {
        const paragraph = paragraphMatch[1].trim();
        const firstSentence = paragraph.split(/[.!?]/)[0];
        if (firstSentence && firstSentence.length > 10) {
          return firstSentence.trim() + (firstSentence.length < paragraph.length ? '...' : '');
        }
      }

      return `Development rules and guidelines for ${domain.replace(/[-_]/g, ' ')}`;
    } catch (error) {
      return `Rules for ${domain}`;
    }
  }

  hasAuthToken(): boolean { return !!this.token; }

  getRepositoryInfo(): string { return `${this.owner}/${this.repo}/${this.path} (branch: ${this.branch})`; }
}