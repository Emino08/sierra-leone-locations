import { ValidationResult } from '../types';
import { LocationService } from './LocationService';
import { normalize } from '../utils/normalize';
import { SecurityValidator } from '../utils/security';
import { SearchService } from './SearchService';

export class ValidationService {
  private locationService: LocationService;
  private searchService: SearchService;
  private initialized = false;

  constructor() {
    this.locationService = LocationService.getInstance();
    this.searchService = new SearchService();
  }

  /**
   * Initialize with CSV data
   */
  async initialize(csvData?: string): Promise<void> {
    if (!this.initialized) {
      await this.searchService.initialize(csvData);
      this.initialized = true;
    }
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Validate region (province) name
   */
  async isValidRegion(name: string): Promise<ValidationResult> {
    try {
      await this.ensureInitialized();
      
      const sanitized = SecurityValidator.sanitizeSearchQuery(name);
      const regions = await this.locationService.getProvinces();
      const normalized = normalize(sanitized);

      const isValid = regions.some(r => normalize(r) === normalized);

      if (isValid) {
        return { isValid: true };
      }

      const suggestions = await this.searchService.getSuggestions(sanitized, 'region', 3);

      return {
        isValid: false,
        message: `'${name}' is not a valid region`,
        suggestions
      };
    } catch (error) {
      return {
        isValid: false,
        message: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }

  /**
   * Validate district name
   */
  async isValidDistrict(name: string, regionName?: string): Promise<ValidationResult> {
    try {
      await this.ensureInitialized();
      
      const sanitized = SecurityValidator.sanitizeSearchQuery(name);
      let districts: string[];
      
      if (regionName) {
        const sanitizedRegion = SecurityValidator.sanitizeSearchQuery(regionName);
        districts = await this.locationService.getDistricts(sanitizedRegion);
      } else {
        districts = await this.locationService.getDistricts();
      }
      
      const normalized = normalize(sanitized);
      const isValid = districts.some(d => normalize(d) === normalized);

      if (isValid) {
        return { isValid: true };
      }

      const suggestions = await this.searchService.getSuggestions(sanitized, 'district', 3);

      return {
        isValid: false,
        message: regionName 
          ? `'${name}' is not a valid district in ${regionName}`
          : `'${name}' is not a valid district`,
        suggestions
      };
    } catch (error) {
      return {
        isValid: false,
        message: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }

  /**
   * Validate council name
   */
  async isValidCouncil(name: string, districtName: string): Promise<ValidationResult> {
    try {
      await this.ensureInitialized();
      
      const sanitized = SecurityValidator.sanitizeSearchQuery(name);
      const sanitizedDistrict = SecurityValidator.sanitizeSearchQuery(districtName);
      
      const councils = await this.locationService.getCouncils(sanitizedDistrict);
      const normalized = normalize(sanitized);

      const isValid = councils.some(c => normalize(c) === normalized);

      if (isValid) {
        return { isValid: true };
      }

      const suggestions = await this.searchService.getSuggestions(sanitized, 'council', 3);

      return {
        isValid: false,
        message: `'${name}' is not a valid council in ${districtName}`,
        suggestions
      };
    } catch (error) {
      return {
        isValid: false,
        message: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }

  /**
   * Validate chiefdom name
   */
  async isValidChiefdom(name: string, districtName: string): Promise<ValidationResult> {
    try {
      await this.ensureInitialized();
      
      const sanitized = SecurityValidator.sanitizeSearchQuery(name);
      const sanitizedDistrict = SecurityValidator.sanitizeSearchQuery(districtName);
      
      const chiefdoms = await this.locationService.getChiefdoms(sanitizedDistrict);
      const normalized = normalize(sanitized);

      const isValid = chiefdoms.some(c => normalize(c) === normalized);

      if (isValid) {
        return { isValid: true };
      }

      const suggestions = await this.searchService.getSuggestions(sanitized, 'chiefdom', 3);

      return {
        isValid: false,
        message: `'${name}' is not a valid chiefdom in ${districtName}`,
        suggestions
      };
    } catch (error) {
      return {
        isValid: false,
        message: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }

  /**
   * Validate section name
   */
  async isValidSection(name: string, chiefdomName: string): Promise<ValidationResult> {
    try {
      await this.ensureInitialized();
      
      const sanitized = SecurityValidator.sanitizeSearchQuery(name);
      const sanitizedChiefdom = SecurityValidator.sanitizeSearchQuery(chiefdomName);
      
      const sections = await this.locationService.getSections(sanitizedChiefdom);
      const normalized = normalize(sanitized);

      const isValid = sections.some(s => normalize(s) === normalized);

      if (isValid) {
        return { isValid: true };
      }

      const suggestions = await this.searchService.getSuggestions(sanitized, 'section', 3);

      return {
        isValid: false,
        message: `'${name}' is not a valid section in ${chiefdomName}`,
        suggestions
      };
    } catch (error) {
      return {
        isValid: false,
        message: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }

  /**
   * Validate town name
   */
  async isValidTown(name: string, chiefdomName?: string, sectionName?: string): Promise<ValidationResult> {
    try {
      await this.ensureInitialized();
      
      const sanitized = SecurityValidator.sanitizeSearchQuery(name);
      let towns: string[];
      
      if (chiefdomName) {
        const sanitizedChiefdom = SecurityValidator.sanitizeSearchQuery(chiefdomName);
        const sanitizedSection = sectionName ? SecurityValidator.sanitizeSearchQuery(sectionName) : undefined;
        towns = await this.locationService.getTowns(sanitizedChiefdom, sanitizedSection);
      } else {
        towns = await this.locationService.getTowns();
      }
      
      const normalized = normalize(sanitized);
      const isValid = towns.some(t => normalize(t) === normalized);

      if (isValid) {
        return { isValid: true };
      }

      const suggestions = await this.searchService.getSuggestions(sanitized, 'town', 3);

      return {
        isValid: false,
        message: chiefdomName 
          ? `'${name}' is not a valid town in ${chiefdomName}`
          : `'${name}' is not a valid town`,
        suggestions
      };
    } catch (error) {
      return {
        isValid: false,
        message: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }

  /**
   * Validate complete location hierarchy
   */
  async validateLocationHierarchy(location: {
    region?: string;
    district?: string;
    council?: string;
    chiefdom?: string;
    section?: string;
    town?: string;
  }): Promise<ValidationResult> {
    try {
      await this.ensureInitialized();

      const errors: string[] = [];

      // Validate region
      if (location.region) {
        const regionResult = await this.isValidRegion(location.region);
        if (!regionResult.isValid) {
          errors.push(regionResult.message || 'Invalid region');
        }
      }

      // Validate district
      if (location.district) {
        const districtResult = await this.isValidDistrict(location.district, location.region);
        if (!districtResult.isValid) {
          errors.push(districtResult.message || 'Invalid district');
        }
      }

      // Validate council
      if (location.council && location.district) {
        const councilResult = await this.isValidCouncil(location.council, location.district);
        if (!councilResult.isValid) {
          errors.push(councilResult.message || 'Invalid council');
        }
      }

      // Validate chiefdom
      if (location.chiefdom && location.district) {
        const chiefdomResult = await this.isValidChiefdom(location.chiefdom, location.district);
        if (!chiefdomResult.isValid) {
          errors.push(chiefdomResult.message || 'Invalid chiefdom');
        }
      }

      // Validate section
      if (location.section && location.chiefdom) {
        const sectionResult = await this.isValidSection(location.section, location.chiefdom);
        if (!sectionResult.isValid) {
          errors.push(sectionResult.message || 'Invalid section');
        }
      }

      // Validate town
      if (location.town) {
        const townResult = await this.isValidTown(location.town, location.chiefdom, location.section);
        if (!townResult.isValid) {
          errors.push(townResult.message || 'Invalid town');
        }
      }

      return {
        isValid: errors.length === 0,
        message: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      return {
        isValid: false,
        message: error instanceof Error ? error.message : 'Validation error'
      };
    }
  }

  /**
   * Batch validation for multiple locations
   */
  async validateBatch(locations: string[], type: 'region' | 'district' | 'council' | 'chiefdom' | 'section' | 'town'): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const location of locations) {
      try {
        let result: ValidationResult;
        
        switch (type) {
          case 'region':
            result = await this.isValidRegion(location);
            break;
          case 'district':
            result = await this.isValidDistrict(location);
            break;
          case 'town':
            result = await this.isValidTown(location);
            break;
          default:
            result = { isValid: false, message: 'Invalid validation type' };
        }
        
        results.push(result);
      } catch (error) {
        results.push({
          isValid: false,
          message: error instanceof Error ? error.message : 'Validation error'
        });
      }
    }
    
    return results;
  }
}