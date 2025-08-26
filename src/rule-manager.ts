import { RepositoryFileReader, RuleContent, DomainInfo } from './repository-file-reader.js';
import { Logger, OperationContinuity } from './error-handler.js';

/**
 * RuleManager handles rule loading, caching, and provides high-level access to rule content
 * Uses RepositoryFileReader for file system operations
 */
export class RuleManager {
  private fileReader: RepositoryFileReader;
  private cache: Map<string, RuleContent> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

  constructor(rulesDirectory: string = './rules') {
    this.fileReader = new RepositoryFileReader(rulesDirectory);
  }

  /**
   * Get rule content for a specific domain
   * @param domain - The domain name to retrieve
   * @returns Promise<RuleContent | null> - Rule content or null if not found
   */
  async getRuleContent(domain: string): Promise<RuleContent | null> {
    try {
      // Check cache first
      const cached = this.getCachedContent(domain);
      if (cached) {
        return cached;
      }

      // Check if rule exists
      const exists = await this.fileReader.ruleExists(domain);
      if (!exists) {
        Logger.warn(`Rule not found for domain: ${domain}`, { domain });
        return null;
      }

      // Read and parse the rule file
      const content = await this.fileReader.readRuleFile(domain);
      const ruleContent = this.fileReader.parseRuleContent(content, domain);

      // Cache the result
      this.cache.set(domain, ruleContent);
      this.cacheTimestamps.set(domain, Date.now());

      return ruleContent;
    } catch (error) {
      Logger.error(`Error getting rule content for domain ${domain}`, error, { domain });
      return null;
    }
  }

  /**
   * List all available domains with their descriptions
   * @returns Promise<DomainInfo[]> - Array of domain information
   */
  async listAvailableDomains(): Promise<DomainInfo[]> {
    try {
      const domains = await this.fileReader.listRuleFiles();
      const domainInfos: DomainInfo[] = [];

      // Process each domain to extract metadata
      for (const domain of domains) {
        try {
          const ruleContent = await this.getRuleContent(domain);
          if (ruleContent) {
            domainInfos.push({
              domain: ruleContent.domain,
              description: ruleContent.description || `Rules for ${domain}`,
              lastUpdated: ruleContent.lastUpdated
            });
          }
        } catch (error) {
          Logger.warn(`Failed to process domain ${domain}`, { domain, error: error instanceof Error ? error.message : error });
          // Continue processing other domains even if one fails
          domainInfos.push({
            domain,
            description: `Rules for ${domain} (metadata unavailable)`
          });
        }
      }

      return domainInfos;
    } catch (error) {
      Logger.error('Error listing available domains', error);
      return [];
    }
  }

  /**
   * Check if cached content is still valid
   * @param domain - Domain to check
   * @returns RuleContent | null - Cached content if valid, null otherwise
   */
  private getCachedContent(domain: string): RuleContent | null {
    const cached = this.cache.get(domain);
    const timestamp = this.cacheTimestamps.get(domain);

    if (cached && timestamp && (Date.now() - timestamp) < this.CACHE_TTL) {
      return cached;
    }

    // Remove expired cache entries
    if (cached) {
      this.cache.delete(domain);
      this.cacheTimestamps.delete(domain);
    }

    return null;
  }

  /**
   * Clear the cache for a specific domain or all domains
   * @param domain - Optional domain to clear, if not provided clears all
   */
  clearCache(domain?: string): void {
    if (domain) {
      this.cache.delete(domain);
      this.cacheTimestamps.delete(domain);
      Logger.info(`Cache cleared for domain: ${domain}`, { domain });
    } else {
      this.cache.clear();
      this.cacheTimestamps.clear();
      Logger.info('All cache cleared');
    }
  }

  /**
   * Get cache statistics
   * @returns Object with cache information
   */
  getCacheStats(): { size: number; domains: string[] } {
    return {
      size: this.cache.size,
      domains: Array.from(this.cache.keys())
    };
  }

  /**
   * Handle concurrent requests safely by ensuring only one request per domain at a time
   * @param domain - Domain to get content for
   * @returns Promise<RuleContent | null>
   */
  private requestPromises: Map<string, Promise<RuleContent | null>> = new Map();

  async getRuleContentSafe(domain: string): Promise<RuleContent | null> {
    // Check if there's already a request in progress for this domain
    const existingPromise = this.requestPromises.get(domain);
    if (existingPromise) {
      return existingPromise;
    }

    // Create new request promise
    const promise = this.getRuleContent(domain);
    this.requestPromises.set(domain, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up the promise from the map
      this.requestPromises.delete(domain);
    }
  }

  /**
   * Get rule content for multiple domains efficiently
   * @param domains - Array of domain names to retrieve
   * @returns Promise<Map<string, RuleContent | null>> - Map of domain to rule content
   */
  async getMultipleRuleContents(domains: string[]): Promise<Map<string, RuleContent | null>> {
    const results = new Map<string, RuleContent | null>();
    
    // Process all domains concurrently
    const promises = domains.map(async (domain) => {
      try {
        const content = await this.getRuleContentSafe(domain);
        results.set(domain, content);
      } catch (error) {
        Logger.warn(`Failed to get rule content for domain ${domain}`, { domain, error: error instanceof Error ? error.message : error });
        results.set(domain, null);
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Get the rules directory path
   * @returns string - The rules directory path
   */
  getRulesDirectory(): string {
    return this.fileReader.getRulesDirectory();
  }
}