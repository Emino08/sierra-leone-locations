import { LocationService } from './core/LocationService';
import { ValidationService } from './core/ValidationService';
import { SearchService } from './core/SearchService';
import { ExportService } from './core/ExportService';
import { deepFreeze } from './utils/security';
import { LocationQuery, SearchOptions, ExportFormat } from './types';

// Types exports
export * from './types';

// Create singleton instances
const locationService = LocationService.getInstance();
const validationService = new ValidationService();
const searchService = new SearchService();
const exportService = new ExportService();

/**
 * Sierra Leone Locations API
 */
const SierraLeoneLocations = {
  // Location Access
  getProvinces: () => locationService.getProvinces(),
  getDistricts: (provinceName?: string) => locationService.getDistricts(provinceName),
  getChiefdoms: (districtName: string) => locationService.getChiefdoms(districtName),
  getTowns: (chiefdomName: string) => locationService.getTowns(chiefdomName),

  // Place Lookup
  findPlace: (name: string) => locationService.findPlace(name),
  getLocationsByQuery: (query: LocationQuery) => locationService.getLocationsByQuery(query),

  // Search & Autocomplete
  autocomplete: (query: string, clientId?: string, limit?: number) => searchService.autocomplete(query, clientId, limit),
  search: (query: string, options?: SearchOptions) => searchService.search(query, options),

  // Validation
  isValidProvince: (name: string) => validationService.isValidRegion(name),
  isValidDistrict: (name: string, provinceName?: string) =>
    validationService.isValidDistrict(name, provinceName),
  isValidChiefdom: (name: string, districtName: string) =>
    validationService.isValidChiefdom(name, districtName),
  isValidTown: (name: string, chiefdomName?: string, sectionName?: string) =>
    validationService.isValidTown(name, chiefdomName, sectionName),

  // Export
  export: (format: ExportFormat, query?: LocationQuery) => exportService.export(format, query),
  exportByType: (type: 'province' | 'district' | 'chiefdom' | 'town', format?: ExportFormat) => exportService.exportByType(type, format),
  exportHierarchy: (locationName: string, format?: ExportFormat) =>
    exportService.exportHierarchy(locationName, format),

  // Utility
  clearCache: () => locationService.clearCache()
};

// Freeze the API object to prevent modification
const SL = deepFreeze(SierraLeoneLocations);

// Named exports for tree-shaking
export const getProvinces = SL.getProvinces;
export const getDistricts = SL.getDistricts;
export const getChiefdoms = SL.getChiefdoms;
export const getTowns = SL.getTowns;
export const findPlace = SL.findPlace;
export const autocomplete = SL.autocomplete;
export const search = SL.search;
export const isValidProvince = SL.isValidProvince;
export const isValidDistrict = SL.isValidDistrict;
export const isValidChiefdom = SL.isValidChiefdom;
export const isValidTown = SL.isValidTown;

// Default export
export default SL;