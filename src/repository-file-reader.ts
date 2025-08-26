import { promises as fs } from 'fs';
import * as path from 'path';

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
 * RepositoryFileReader handles reading rule files from the rules/ directory
 * Provides methods to read specific files, list available files, and check existence
 */
export class RepositoryFileReader {
  private rulesDirectory: string;

  constructor(rulesDirectory: string = './rules') {
    this.rulesDirectory = path.resolve(rulesDirectory);
  }

  /**
   * Read a specific rule file by domain name
   * @param domain - The domain name (filename without .md extension)
   * @returns Promise<string> - The file content
   * @throws Error if file doesn't exist or can't be read
   */
  async readRuleFile(domain: string): Promise<string> {
    try {
      const filePath = path.join(this.rulesDirectory, `${domain}.md`);
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        if (error.code === 'ENOENT') {
          throw new Error(`Rule file not found for domain: ${domain}`);
        }
        if (error.code === 'EACCES') {
          throw new Error(`Permission denied reading rule file for domain: ${domain}`);
        }
      }
      throw new Error(`Failed to read rule file for domain ${domain}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all available rule files in the rules/ directory
   * Filters out invalid files and logs errors gracefully
   * @returns Promise<string[]> - Array of domain names (filenames without .md extension)
   */
  async listRuleFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.rulesDirectory);
      const validDomains: string[] = [];
      
      for (const file of files) {
        if (!file.endsWith('.md')) {
          continue;
        }
        
        const domain = this.extractDomainFromFilename(file);
        
        // Validate domain name format
        if (!this.isValidDomain(domain)) {
          console.warn(`Skipping invalid domain name: ${domain} (from file: ${file})`);
          continue;
        }
        
        // Try to read and parse the file to ensure it's valid
        try {
          const content = await this.readRuleFile(domain);
          this.parseRuleContent(content, domain); // This will log errors internally if parsing fails
          validDomains.push(domain);
        } catch (error) {
          console.error(`Skipping invalid rule file ${file}:`, error instanceof Error ? error.message : error);
          // Continue with other files even if one fails
        }
      }
      
      return validDomains;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        if (error.code === 'ENOENT') {
          // Rules directory doesn't exist, return empty array
          console.warn(`Rules directory not found: ${this.rulesDirectory}`);
          return [];
        }
        if (error.code === 'EACCES') {
          throw new Error(`Permission denied accessing rules directory: ${this.rulesDirectory}`);
        }
      }
      throw new Error(`Failed to list rule files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a rule file exists for the given domain
   * @param domain - The domain name to check
   * @returns Promise<boolean> - True if file exists, false otherwise
   */
  async ruleExists(domain: string): Promise<boolean> {
    try {
      const filePath = path.join(this.rulesDirectory, `${domain}.md`);
      await fs.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse rule content and extract metadata from markdown
   * Handles both YAML frontmatter and inline metadata formats
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
        // Fall back to inline metadata parsing (current format)
        this.parseInlineMetadata(content, ruleContent);
      }

      return ruleContent;
    } catch (error) {
      // Handle invalid markdown gracefully - return basic content with error logging
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
   * @param frontmatter - The frontmatter content
   * @param ruleContent - The rule content object to populate
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
   * Parse inline metadata (current format with bullet points)
   * @param content - The full markdown content
   * @param ruleContent - The rule content object to populate
   */
  private parseInlineMetadata(content: string, ruleContent: RuleContent): void {
    // Extract metadata from markdown content
    // Look for patterns like "- Description: ..." handling both Unix and Windows line endings
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
   * Extract domain name from filename (without .md extension)
   * @param filename - The filename to process
   * @returns string - The domain name
   */
  extractDomainFromFilename(filename: string): string {
    // Remove .md extension if present
    if (filename.endsWith('.md')) {
      return filename.slice(0, -3);
    }
    return filename;
  }

  /**
   * Validate domain name format
   * @param domain - The domain name to validate
   * @returns boolean - True if valid, false otherwise
   */
  isValidDomain(domain: string): boolean {
    // Domain should be non-empty, contain only alphanumeric characters, hyphens, and underscores
    return /^[a-zA-Z0-9_-]+$/.test(domain) && domain.length > 0;
  }

  /**
   * Get the rules directory path
   * @returns string - The absolute path to the rules directory
   */
  getRulesDirectory(): string {
    return this.rulesDirectory;
  }
}