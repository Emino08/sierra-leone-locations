import { SearchResult, LocationRecord, SearchOptions, SearchIndexEntry, LocationType } from '../types';
import { LocationService } from './LocationService';
import { calculateSimilarity, normalize } from '../utils/normalize';
import { SecurityValidator } from '../utils/security';

export class SearchService {
  private locationService: LocationService;
  private searchIndex: Map<string, SearchIndexEntry[]> = new Map();
  private rateLimit: Map<string, number[]> = new Map();

  constructor() {
    this.locationService = LocationService.getInstance();
  }

  /**
   * Initialize search service with CSV data
   */
  async initialize(csvData?: string): Promise<void> {
    if (csvData) {
      await this.locationService.initializeWithData(csvData);
    }
    await this.buildSearchIndex();
  }

  /**
   * Build comprehensive search index from CSV data
   */
  private async buildSearchIndex(): Promise<void> {
    try {
      const stats = await this.locationService.getStatistics();
      console.log(`Building search index for ${stats.totalRecords} records...`);

      // Get all records for indexing
      const allRecords = await this.locationService.getLocationsByQuery({});
      
      allRecords.forEach(record => {
        this.addToIndex(record.idregion, 'region', record);
        this.addToIndex(record.iddistrict, 'district', record);
        this.addToIndex(record.idcouncil, 'council', record);
        this.addToIndex(record.idchiefdom, 'chiefdom', record);
        this.addToIndex(record.idsection, 'section', record);
        this.addToIndex(record.idtown, 'town', record);
      });

      console.log(`Search index built with ${this.searchIndex.size} entries`);
    } catch (error) {
      console.error('Failed to build search index:', error);
      throw error;
    }
  }

  /**
   * Add entry to search index with multiple key variants
   */
  private addToIndex(name: string, type: string, record: LocationRecord): void {
    if (!name || name.trim().length === 0) return;

    const normalized = normalize(name);
    const entry: SearchIndexEntry = {
      name: name.trim(),
      type: this.normalizeLocationType(type),
      normalized,
      record
    };

    // Add to main normalized key
    this.addEntryToKey(normalized, entry);

    // Add partial matches for better search
    const words = normalized.split(' ');
    if (words.length > 1) {
      words.forEach(word => {
        if (word.length > 2) {
          const partialEntry = { ...entry, partialMatch: true };
          this.addEntryToKey(word, partialEntry);
        }
      });
    }

    // Add phonetic key for fuzzy search
    const phoneticKey = this.getPhoneticKey(normalized);
    if (phoneticKey !== normalized) {
      const phoneticEntry = { ...entry, partialMatch: true };
      this.addEntryToKey(phoneticKey, phoneticEntry);
    }
  }

  /**
   * Convert string to valid LocationType
   */
  private normalizeLocationType(type: string): LocationType {
    const typeMap: Record<string, LocationType> = {
      'region': 'region',
      'province': 'province', 
      'district': 'district',
      'council': 'council',
      'chiefdom': 'chiefdom',
      'section': 'section',
      'town': 'town',
      'village': 'village'
    };
    return typeMap[type.toLowerCase()] as LocationType || 'town';
  }

  /**
   * Add entry to specific key in index
   */
  private addEntryToKey(key: string, entry: SearchIndexEntry): void {
    if (!this.searchIndex.has(key)) {
      this.searchIndex.set(key, []);
    }
    const entries = this.searchIndex.get(key)!;
    
    // Avoid duplicates
    const exists = entries.some(e => 
      e.name === entry.name && 
      e.type === entry.type && 
      e.normalized === entry.normalized
    );
    
    if (!exists) {
      entries.push(entry);
    }
  }

  /**
   * Simple phonetic key generation for fuzzy matching
   */
  private getPhoneticKey(text: string): string {
    return text
      .replace(/[aeiou]/g, '') // Remove vowels
      .replace(/(.)\1+/g, '$1') // Remove duplicate consonants
      .substring(0, 6); // Limit length
  }

  /**
   * Autocomplete search with security and rate limiting
   */
  async autocomplete(query: string, clientId = 'anonymous', limit = 10): Promise<string[]> {
    // Rate limiting check
    if (!SecurityValidator.checkRateLimit(clientId, this.rateLimit, 50, 60000)) {
      throw new Error('Rate limit exceeded');
    }

    const sanitized = SecurityValidator.sanitizeSearchQuery(query);
    if (!sanitized || sanitized.length < 2) return [];

    const normalized = normalize(sanitized);
    const results: Array<{ name: string; score: number }> = [];
    const seen = new Set<string>();

    // Search through index
    for (const [key, entries] of this.searchIndex.entries()) {
      if (key.includes(normalized) || normalized.includes(key)) {
        entries.forEach(entry => {
          if (!seen.has(entry.name)) {
            const score = calculateSimilarity(normalized, entry.normalized);
            if (score > 0.3) {
              results.push({ name: entry.name, score });
              seen.add(entry.name);
            }
          }
        });
      }
    }

    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.name);
  }

  /**
   * Enhanced full text search with performance optimization
   */
  async search(query: string, options: SearchOptions = {}, clientId = 'anonymous'): Promise<SearchResult[]> {
    // Rate limiting check
    if (!SecurityValidator.checkRateLimit(clientId, this.rateLimit, 30, 60000)) {
      throw new Error('Rate limit exceeded');
    }

    const sanitized = SecurityValidator.sanitizeSearchQuery(query);
    if (!sanitized) return [];

    const {
      limit = 20,
      minScore = 0.3,
      types = ['region', 'district', 'council', 'chiefdom', 'section', 'town'],
      fuzzy = true
    } = options;

    const normalized = normalize(sanitized);
    const results: SearchResult[] = [];
    const seen = new Set<string>();

    // Exact matches first
    const exactEntries = this.searchIndex.get(normalized) || [];
    exactEntries.forEach(entry => {
      if (types.includes(entry.type) && !seen.has(`${entry.name}-${entry.type}`)) {
        results.push(this.createSearchResult(entry, 1.0));
        seen.add(`${entry.name}-${entry.type}`);
      }
    });

    // Partial matches if we need more results
    if (results.length < limit) {
      const queryWords = normalized.split(' ');
      
      for (const word of queryWords) {
        if (word.length > 2) {
          const partialEntries = this.searchIndex.get(word) || [];
          partialEntries.forEach(entry => {
            if (types.includes(entry.type) && !seen.has(`${entry.name}-${entry.type}`)) {
              const score = calculateSimilarity(normalized, entry.normalized);
              if (score >= minScore) {
                results.push(this.createSearchResult(entry, score));
                seen.add(`${entry.name}-${entry.type}`);
              }
            }
          });
        }
      }
    }

    // Fuzzy matching if enabled and still need more results
    if (fuzzy && results.length < limit / 2) {
      const phonetic = this.getPhoneticKey(normalized);
      const phoneticEntries = this.searchIndex.get(phonetic) || [];
      
      phoneticEntries.forEach(entry => {
        if (types.includes(entry.type) && !seen.has(`${entry.name}-${entry.type}`)) {
          const score = calculateSimilarity(normalized, entry.normalized) * 0.8; // Lower score for fuzzy
          if (score >= minScore) {
            results.push(this.createSearchResult(entry, score));
            seen.add(`${entry.name}-${entry.type}`);
          }
        }
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Create search result from index entry
   */
  private createSearchResult(entry: SearchIndexEntry, score: number): SearchResult {
    return {
      name: entry.name,
      type: entry.type,
      fullPath: this.buildFullPath(entry),
      code: `SL-${entry.type.toUpperCase()}-${normalize(entry.name)}`,
      score
    };
  }

  /**
   * Build full hierarchical path for display
   */
  private buildFullPath(entry: SearchIndexEntry): string {
    if (!entry.record) return entry.name;

    const parts = [];
    if (entry.record.idregion) parts.push(entry.record.idregion);
    if (entry.record.iddistrict && entry.record.iddistrict !== entry.record.idregion) {
      parts.push(entry.record.iddistrict);
    }
    if (entry.record.idchiefdom && entry.record.idchiefdom !== entry.record.iddistrict) {
      parts.push(entry.record.idchiefdom);
    }
    if (entry.name !== entry.record.idchiefdom) {
      parts.push(entry.name);
    }
    
    return parts.join(' > ');
  }

  /**
   * Get search suggestions based on partial input
   */
  async getSuggestions(partial: string, type?: string, limit = 5): Promise<string[]> {
    const sanitized = SecurityValidator.sanitizeSearchQuery(partial);
    if (!sanitized || sanitized.length < 1) return [];

    const normalized = normalize(sanitized);
    const suggestions = new Set<string>();

    // Find entries that start with the partial input
    for (const [key, entries] of this.searchIndex.entries()) {
      if (key.startsWith(normalized)) {
        entries.forEach(entry => {
          if (!type || entry.type === type) {
            suggestions.add(entry.name);
          }
        });
      }
      
      if (suggestions.size >= limit) break;
    }

    return Array.from(suggestions).slice(0, limit).sort();
  }

  /**
   * Clear rate limiting data (for cleanup)
   */
  clearRateLimit(): void {
    this.rateLimit.clear();
  }
}