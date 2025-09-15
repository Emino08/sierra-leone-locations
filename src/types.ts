// Raw CSV location record matching the actual data structure
export interface LocationRecord {
  idregion: string;
  iddistrict: string;
  idcouncil: string;
  idchiefdom: string;
  idsection: string;
  idtown: string;
}

// Processed location interfaces for API usage
export interface Location {
  name: string;
  type: LocationType;
  code: string;
  alternativeNames?: string[];
  coordinates?: Coordinates;
}

export interface Province extends Location {
  type: 'province';
  districts: District[];
}

export interface District extends Location {
  type: 'district';
  province: string;
  provinceCode: string;
  chiefdoms: Chiefdom[];
}

export interface Chiefdom extends Location {
  type: 'chiefdom';
  district: string;
  districtCode: string;
  province: string;
  provinceCode: string;
  towns: Town[];
}

export interface Town extends Location {
  type: 'town' | 'village';
  chiefdom: string;
  chiefdomCode: string;
  district: string;
  districtCode: string;
  province: string;
  provinceCode: string;
  population?: number;
  section?: string; // Added section from CSV
  council?: string; // Added council from CSV
}

export type LocationType = 'region' | 'district' | 'council' | 'chiefdom' | 'section' | 'town' | 'province' | 'village';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SearchResult {
  name: string;
  type: LocationType;
  fullPath: string;
  code: string;
  score: number;
}

export interface PlaceDetails {
  name: string;
  type: LocationType;
  code: string;
  province?: string;
  district?: string;
  chiefdom?: string;
  districts?: string[];
  chiefdoms?: string[];
  towns?: string[];
  population?: number;
  coordinates?: Coordinates;
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  suggestions?: string[];
}

export type ExportFormat = 'json' | 'csv' | 'array';

export interface LocationQuery {
  province?: string;
  district?: string;
  chiefdom?: string;
  type?: LocationType;
}

// Search and autocomplete interfaces
export interface SearchOptions {
  limit?: number;
  minScore?: number;
  types?: LocationType[];
  fuzzy?: boolean;
}

export interface SearchIndexEntry {
  name: string;
  type: LocationType;
  normalized: string;
  record: LocationRecord;
  searchType?: string;
  partialMatch?: boolean;
}

// Export interfaces
export interface ExportQuery {
  province?: string;
  district?: string;
  chiefdom?: string;
  type?: LocationType;
}

// Location hierarchy validation
export interface LocationHierarchy {
  region?: string;
  district?: string;
  council?: string;
  chiefdom?: string;
  section?: string;
  town?: string;
}

// Statistics interface
export interface LocationStatistics {
  totalRecords: number;
  regions: number;
  districts: number;
  councils: number;
  chiefdoms: number;
  sections: number;
  towns: number;
  cacheSize: number;
  indexSize: number;
}