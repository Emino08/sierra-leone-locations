import { Province, LocationRecord, PlaceDetails, LocationQuery, SearchIndexEntry, LocationStatistics } from '../types';
import { normalize } from '../utils/normalize';
import { SecurityValidator } from '../utils/security';
import { processCsvToHierarchy, createSearchIndex, validateCsvData } from '../data/processor';

export class LocationService {
  private static instance: LocationService;
  private data: Province[] = [];
  private rawData: LocationRecord[] = [];
  private cache: Map<string, unknown> = new Map();
  private searchIndex: Map<string, SearchIndexEntry[]> = new Map();
  private initialized = false;
  private readonly maxCacheSize = 1000;
  private cacheAccessTimes: Map<string, number> = new Map();

  private constructor() {
    // Don't initialize immediately - wait for explicit initialization
  }

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Initialize data from CSV file or provided data
   */
  private async initializeData(csvData?: string): Promise<void> {
    if (this.initialized) return;

    try {
      let data: string;
      
      if (csvData) {
        data = csvData;
      } else {
        // Try to load from environment or throw error
        throw new Error('CSV data must be provided during initialization');
      }

      // Validate CSV data
      const validation = validateCsvData(data);
      if (!validation.isValid) {
        throw new Error(`Invalid CSV data: ${validation.errors.join(', ')}`);
      }

      // Parse CSV and build hierarchy
      this.data = processCsvToHierarchy(data);
      
      // Extract raw records for direct access
      this.extractRawRecords(data);
      
      // Create search index for performance
      this.searchIndex = createSearchIndex(this.data);
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize location data:', error);
      throw error;
    }
  }

  /**
   * Initialize with CSV data (public method for external initialization)
   */
  async initializeWithData(csvData: string): Promise<void> {
    await this.initializeData(csvData);
  }

  /**
   * Lightweight sanitization for CSV data - only removes dangerous characters
   */
  private sanitizeLocationName(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    // Only remove truly dangerous characters, allow normal text with commas, parentheses, etc.
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript protocols
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Parse CSV line properly handling quoted fields with commas
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    
    return result;
  }

  /**
   * Extract raw CSV records for direct access patterns
   */
  private extractRawRecords(csvData: string): void {
    const lines = csvData.trim().split('\n');
    const [, ...dataLines] = lines; // Skip header
    
    this.rawData = dataLines.map(line => {
      const fields = this.parseCsvLine(line);
      
      if (fields.length !== 6) {
        // Try to recover from malformed lines by taking the first 6 fields or padding
        while (fields.length < 6) fields.push('');
        if (fields.length > 6) fields.splice(6);
      }
      
      const [idregion, iddistrict, idcouncil, idchiefdom, idsection, idtown] = fields;
      return {
        idregion: this.sanitizeLocationName(idregion || ''),
        iddistrict: this.sanitizeLocationName(iddistrict || ''),
        idcouncil: this.sanitizeLocationName(idcouncil || ''),
        idchiefdom: this.sanitizeLocationName(idchiefdom || ''),
        idsection: this.sanitizeLocationName(idsection || ''),
        idtown: this.sanitizeLocationName(idtown || '')
      };
    }).filter(record => record.idregion && record.idtown);
  }

  /**
   * Manage cache size and evict least recently used items
   */
  private manageCacheSize(): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Find least recently used item
      let oldestKey = '';
      let oldestTime = Date.now();
      
      for (const [key, time] of this.cacheAccessTimes.entries()) {
        if (time < oldestTime) {
          oldestTime = time;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.cacheAccessTimes.delete(oldestKey);
      }
    }
  }

  /**
   * Get from cache with LRU tracking
   */
  private getFromCache(key: string): unknown {
    if (this.cache.has(key)) {
      this.cacheAccessTimes.set(key, Date.now());
      return this.cache.get(key);
    }
    return undefined;
  }

  /**
   * Set to cache with LRU management
   */
  private setToCache(key: string, value: unknown): void {
    this.manageCacheSize();
    this.cache.set(key, value);
    this.cacheAccessTimes.set(key, Date.now());
  }

  /**
   * Ensure data is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initializeData();
    }
  }

  /**
   * Get all provinces (regions)
   */
  async getProvinces(): Promise<string[]> {
    await this.ensureInitialized();
    
    const cacheKey = 'provinces';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as string[];

    // Use direct CSV access for better performance
    const provinces = Array.from(new Set(this.rawData.map(record => record.idregion)))
      .filter(region => region.trim().length > 0)
      .sort();
    
    this.setToCache(cacheKey, provinces);
    return provinces;
  }

  /**
   * Get full Province data structure
   */
  async getFullProvinceData(): Promise<Province[]> {
    await this.ensureInitialized();
    return this.data;
  }

  /**
   * Get all districts in a province
   */
  async getDistricts(provinceName?: string): Promise<string[]> {
    await this.ensureInitialized();
    
    if (!provinceName) {
      const cacheKey = 'all-districts';
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached as string[];
      
      const districts = Array.from(new Set(this.rawData.map(record => record.iddistrict)))
        .filter(district => district.trim().length > 0)
        .sort();
      
      this.setToCache(cacheKey, districts);
      return districts;
    }

    const sanitized = SecurityValidator.sanitize(provinceName);
    const normalized = normalize(sanitized);
    const cacheKey = `districts-${normalized}`;

    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as string[];

    // Filter districts by province using raw data for performance
    const districts = Array.from(new Set(
      this.rawData
        .filter(record => normalize(record.idregion) === normalized)
        .map(record => record.iddistrict)
    )).filter(district => district.trim().length > 0).sort();

    this.setToCache(cacheKey, districts);
    return districts;
  }

  /**
   * Get all councils in a district
   */
  async getCouncils(districtName: string): Promise<string[]> {
    await this.ensureInitialized();
    
    const sanitized = SecurityValidator.sanitize(districtName);
    const normalized = normalize(sanitized);
    const cacheKey = `councils-${normalized}`;

    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as string[];

    const councils = Array.from(new Set(
      this.rawData
        .filter(record => normalize(record.iddistrict) === normalized)
        .map(record => record.idcouncil)
    )).filter(council => council.trim().length > 0).sort();

    this.setToCache(cacheKey, councils);
    return councils;
  }

  /**
   * Get all chiefdoms in a district
   */
  async getChiefdoms(districtName: string): Promise<string[]> {
    await this.ensureInitialized();
    
    const sanitized = SecurityValidator.sanitize(districtName);
    const normalized = normalize(sanitized);
    const cacheKey = `chiefdoms-${normalized}`;

    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as string[];

    const chiefdoms = Array.from(new Set(
      this.rawData
        .filter(record => normalize(record.iddistrict) === normalized)
        .map(record => record.idchiefdom)
    )).filter(chiefdom => chiefdom.trim().length > 0).sort();

    this.setToCache(cacheKey, chiefdoms);
    return chiefdoms;
  }

  /**
   * Get all sections in a chiefdom
   */
  async getSections(chiefdomName: string): Promise<string[]> {
    await this.ensureInitialized();
    
    const sanitized = SecurityValidator.sanitize(chiefdomName);
    const normalized = normalize(sanitized);
    const cacheKey = `sections-${normalized}`;

    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as string[];

    const sections = Array.from(new Set(
      this.rawData
        .filter(record => normalize(record.idchiefdom) === normalized)
        .map(record => record.idsection)
    )).filter(section => section.trim().length > 0).sort();

    this.setToCache(cacheKey, sections);
    return sections;
  }

  /**
   * Get all towns in a chiefdom or section
   */
  async getTowns(chiefdomName?: string, sectionName?: string): Promise<string[]> {
    await this.ensureInitialized();
    
    let cacheKey = 'all-towns';
    let filtered = this.rawData;

    if (chiefdomName) {
      const sanitizedChiefdom = SecurityValidator.sanitize(chiefdomName);
      const normalizedChiefdom = normalize(sanitizedChiefdom);
      cacheKey = `towns-chiefdom-${normalizedChiefdom}`;
      filtered = filtered.filter(record => normalize(record.idchiefdom) === normalizedChiefdom);

      if (sectionName) {
        const sanitizedSection = SecurityValidator.sanitize(sectionName);
        const normalizedSection = normalize(sanitizedSection);
        cacheKey += `-section-${normalizedSection}`;
        filtered = filtered.filter(record => normalize(record.idsection) === normalizedSection);
      }
    }

    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as string[];

    const towns = Array.from(new Set(
      filtered.map(record => record.idtown)
    )).filter(town => town.trim().length > 0).sort();

    this.setToCache(cacheKey, towns);
    return towns;
  }

  /**
   * Enhanced search with fuzzy matching and performance optimization
   */
  async search(query: string, limit: number = 10): Promise<PlaceDetails[]> {
    await this.ensureInitialized();
    
    if (!query || query.trim().length < 2) {
      return [];
    }

    const sanitized = SecurityValidator.sanitize(query);
    const normalized = normalize(sanitized);
    const cacheKey = `search-${normalized}-${limit}`;

    const cached = this.getFromCache(cacheKey) as PlaceDetails[];
    if (cached) return cached;

    const searchResults: SearchIndexEntry[] = [];
    const queryWords = normalized.split(' ').filter(word => word.length > 1);

    // Search using index for better performance
    const indexResults = this.searchIndex.get(normalized) || [];
    searchResults.push(...indexResults.slice(0, limit));

    // If not enough results, try partial matching
    if (searchResults.length < limit) {
      for (const word of queryWords) {
        const partialResults = this.searchIndex.get(word) || [];
        searchResults.push(...partialResults.filter((r: SearchIndexEntry) => r.partialMatch));
        if (searchResults.length >= limit) break;
      }
    }

    // Convert SearchIndexEntry to PlaceDetails
    const results: PlaceDetails[] = searchResults.map(entry => ({
      name: entry.name,
      type: entry.type,
      code: `SL-${entry.type.toUpperCase()}-${normalize(entry.name)}`,
      province: entry.record.idregion,
      district: entry.record.iddistrict,
      chiefdom: entry.record.idchiefdom
    }));

    // Remove duplicates and limit results
    const uniqueResults = Array.from(new Map(results.map(r => [r.code, r])).values())
      .slice(0, limit);

    this.setToCache(cacheKey, uniqueResults);
    return uniqueResults;
  }

  /**
   * Find place by name with enhanced search
   */
  async findPlace(name: string): Promise<PlaceDetails | null> {
    await this.ensureInitialized();
    
    const sanitized = SecurityValidator.sanitize(name);
    const normalized = normalize(sanitized);
    const cacheKey = `place-${normalized}`;

    const cached = this.getFromCache(cacheKey) as PlaceDetails | null;
    if (cached) return cached;

    // Search in raw data for exact match
    const exactMatch = this.rawData.find(record => 
      normalize(record.idtown) === normalized ||
      normalize(record.idchiefdom) === normalized ||
      normalize(record.iddistrict) === normalized ||
      normalize(record.idregion) === normalized
    );

    if (exactMatch) {
      const place: PlaceDetails = {
        name: exactMatch.idtown,
        type: 'town',
        code: `SL-TOWN-${normalize(exactMatch.idtown)}`,
        province: exactMatch.idregion,
        district: exactMatch.iddistrict,
        chiefdom: exactMatch.idchiefdom
      };
      
      this.setToCache(cacheKey, place);
      return place;
    }

    // If no exact match, try fuzzy search
    const searchResults = await this.search(sanitized, 1);
    if (searchResults.length > 0) {
      const result = searchResults[0];
      this.setToCache(cacheKey, result);
      return result;
    }

    this.setToCache(cacheKey, null);
    return null;
  }

  /**
   * Get location hierarchy for a town
   */
  async getLocationHierarchy(townName: string): Promise<LocationRecord | null> {
    await this.ensureInitialized();
    
    const sanitized = SecurityValidator.sanitize(townName);
    const normalized = normalize(sanitized);
    const cacheKey = `hierarchy-${normalized}`;

    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as LocationRecord | null;

    const record = this.rawData.find(r => normalize(r.idtown) === normalized);
    
    this.setToCache(cacheKey, record || null);
    return record || null;
  }

  /**
   * Get statistics about the location data
   */
  async getStatistics(): Promise<LocationStatistics> {
    await this.ensureInitialized();
    
    const cacheKey = 'statistics';
    const cached = this.getFromCache(cacheKey) as LocationStatistics | null;
    if (cached) return cached;

    const stats = {
      totalRecords: this.rawData.length,
      regions: new Set(this.rawData.map(r => r.idregion)).size,
      districts: new Set(this.rawData.map(r => r.iddistrict)).size,
      councils: new Set(this.rawData.map(r => r.idcouncil)).size,
      chiefdoms: new Set(this.rawData.map(r => r.idchiefdom)).size,
      sections: new Set(this.rawData.map(r => r.idsection)).size,
      towns: new Set(this.rawData.map(r => r.idtown)).size,
      cacheSize: this.cache.size,
      indexSize: this.searchIndex.size
    };

    this.setToCache(cacheKey, stats);
    return stats;
  }

  /**
   * Clear cache and reinitialize if needed
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheAccessTimes.clear();
  }

  /**
   * Get locations by query with performance optimization
   */
  async getLocationsByQuery(query: LocationQuery): Promise<LocationRecord[]> {
    await this.ensureInitialized();
    
    const cacheKey = `query-${JSON.stringify(query)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached as LocationRecord[];

    let results = [...this.rawData];

    if (query.province) {
      const normalized = normalize(SecurityValidator.sanitize(query.province));
      results = results.filter(r => normalize(r.idregion) === normalized);
    }

    if (query.district) {
      const normalized = normalize(SecurityValidator.sanitize(query.district));
      results = results.filter(r => normalize(r.iddistrict) === normalized);
    }

    if (query.chiefdom) {
      const normalized = normalize(SecurityValidator.sanitize(query.chiefdom));
      results = results.filter(r => normalize(r.idchiefdom) === normalized);
    }

    this.setToCache(cacheKey, results);
    return results;
  }
}