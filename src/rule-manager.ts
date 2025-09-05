import { GitHubRepositoryFileReader, RuleContent, DomainInfo } from './github-repository-file-reader.js';
import { Logger } from './error-handler.js';

export class RuleManager {
  private fileReader: GitHubRepositoryFileReader;
  private cache: Map<string, RuleContent> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor() { this.fileReader = new GitHubRepositoryFileReader(); }

  async getRuleContent(domain: string): Promise<RuleContent | null> {
    try {
      const cached = this.getCachedContent(domain);
      if (cached) return cached;

      if (this.fileReader.hasAuthToken()) {
        const exists = await this.fileReader.ruleExists(domain);
        if (!exists) {
          Logger.warn(`Rule not found for domain: ${domain}`, { domain });
          return null;
        }
      }

      const content = await this.fileReader.readRuleFile(domain);
      const ruleContent = this.fileReader.parseRuleContent(content, domain);

      this.cache.set(domain, ruleContent);
      this.cacheTimestamps.set(domain, Date.now());

      return ruleContent;
    } catch (error) {
      Logger.error(`Error getting rule content for domain ${domain}`, error, { domain });
      return null;
    }
  }

  async listAvailableDomains(): Promise<DomainInfo[]> {
    try {
      const domains = await this.fileReader.listRuleFiles();
      const hasToken = this.fileReader.hasAuthToken();

      if (!hasToken && domains.length > 5) {
        return domains.map(domain => ({ domain, description: `Development rules and guidelines for ${domain.replace(/[-_]/g, ' ')}` }));
      }

      const domainInfos: DomainInfo[] = [];
      for (const domain of domains) {
        try {
          const ruleContent = await this.getRuleContent(domain);
          domainInfos.push(ruleContent ? {
            domain: ruleContent.domain,
            description: ruleContent.description || `Rules for ${domain}`,
            lastUpdated: ruleContent.lastUpdated
          } : { domain, description: `Rules for ${domain} (metadata unavailable)` });
        } catch (error) {
          Logger.warn(`Failed to process domain ${domain}`, { domain, error: error instanceof Error ? error.message : error });
          domainInfos.push({ domain, description: `Rules for ${domain} (metadata unavailable)` });
        }
      }

      return domainInfos;
    } catch (error) {
      Logger.error('Error listing available domains', error);
      return [];
    }
  }

  private getCachedContent(domain: string): RuleContent | null {
    const cached = this.cache.get(domain);
    const timestamp = this.cacheTimestamps.get(domain);

    if (cached && timestamp && (Date.now() - timestamp) < this.CACHE_TTL) return cached;

    if (cached) {
      this.cache.delete(domain);
      this.cacheTimestamps.delete(domain);
    }

    return null;
  }

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

  getCacheStats(): { size: number; domains: string[] } {
    return { size: this.cache.size, domains: Array.from(this.cache.keys()) };
  }

  private requestPromises: Map<string, Promise<RuleContent | null>> = new Map();

  async getRuleContentSafe(domain: string): Promise<RuleContent | null> {
    const existingPromise = this.requestPromises.get(domain);
    if (existingPromise) return existingPromise;

    const promise = this.getRuleContent(domain);
    this.requestPromises.set(domain, promise);

    try {
      return await promise;
    } finally {
      this.requestPromises.delete(domain);
    }
  }

  async getMultipleRuleContents(domains: string[]): Promise<Map<string, RuleContent | null>> {
    const results = new Map<string, RuleContent | null>();

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

  getRulesDirectory(): string { return this.fileReader.getRepositoryInfo(); }
}