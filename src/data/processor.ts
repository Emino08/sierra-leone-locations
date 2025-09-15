import { LocationRecord, Province, District, Chiefdom, Town, SearchIndexEntry, LocationType } from '../types';
import { normalize } from '../utils/normalize';

/**
 * Lightweight sanitization for CSV data - only removes dangerous characters
 */
function sanitizeLocationName(input: string): string {
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
function parseCsvLine(line: string): string[] {
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
 * Parse CSV data and convert to structured location hierarchy
 */
export function processCsvToHierarchy(csvData: string): Province[] {
  const lines = csvData.trim().split('\n');
  const [header, ...dataLines] = lines;
  
  if (!header || !header.includes('idregion')) {
    throw new Error('Invalid CSV format: missing required headers');
  }

  // Parse CSV records with proper handling of quoted fields
  const records: LocationRecord[] = dataLines.map(line => {
    const fields = parseCsvLine(line);
    
    if (fields.length !== 6) {
      // Try to recover from malformed lines by taking the first 6 fields or padding
      while (fields.length < 6) fields.push('');
      if (fields.length > 6) fields.splice(6);
    }
    
    const [idregion, iddistrict, idcouncil, idchiefdom, idsection, idtown] = fields;
    return {
      idregion: sanitizeLocationName(idregion || ''),
      iddistrict: sanitizeLocationName(iddistrict || ''),
      idcouncil: sanitizeLocationName(idcouncil || ''),
      idchiefdom: sanitizeLocationName(idchiefdom || ''),
      idsection: sanitizeLocationName(idsection || ''),
      idtown: sanitizeLocationName(idtown || '')
    };
  }).filter(record => record.idregion && record.idtown); // Filter out invalid records

  return buildHierarchy(records);
}

/**
 * Build hierarchical structure from flat CSV records
 */
function buildHierarchy(records: LocationRecord[]): Province[] {
  const provinceMap = new Map<string, Province>();
  const districtMap = new Map<string, District>();
  const chiefdomMap = new Map<string, Chiefdom>();

  // Build the hierarchy
  for (const record of records) {
    // Create/get province
    if (!provinceMap.has(record.idregion)) {
      const province: Province = {
        name: record.idregion,
        type: 'province',
        code: generateCode('PROVINCE', record.idregion),
        districts: []
      };
      provinceMap.set(record.idregion, province);
    }
    const province = provinceMap.get(record.idregion)!;

    // Create/get district
    const districtKey = `${record.idregion}-${record.iddistrict}`;
    if (!districtMap.has(districtKey)) {
      const district: District = {
        name: record.iddistrict,
        type: 'district',
        code: generateCode('DISTRICT', record.iddistrict),
        province: record.idregion,
        provinceCode: province.code,
        chiefdoms: []
      };
      districtMap.set(districtKey, district);
      province.districts.push(district);
    }
    const district = districtMap.get(districtKey)!;

    // Create/get chiefdom
    const chiefdomKey = `${districtKey}-${record.idchiefdom}`;
    if (!chiefdomMap.has(chiefdomKey)) {
      const chiefdom: Chiefdom = {
        name: record.idchiefdom,
        type: 'chiefdom',
        code: generateCode('CHIEFDOM', record.idchiefdom),
        district: record.iddistrict,
        districtCode: district.code,
        province: record.idregion,
        provinceCode: province.code,
        towns: []
      };
      chiefdomMap.set(chiefdomKey, chiefdom);
      district.chiefdoms.push(chiefdom);
    }
    const chiefdom = chiefdomMap.get(chiefdomKey)!;

    // Create town
    const town: Town = {
      name: record.idtown,
      type: 'town',
      code: generateCode('TOWN', record.idtown),
      chiefdom: record.idchiefdom,
      chiefdomCode: chiefdom.code,
      district: record.iddistrict,
      districtCode: district.code,
      province: record.idregion,
      provinceCode: province.code,
      section: record.idsection,
      council: record.idcouncil
    };
    chiefdom.towns.push(town);
  }

  return Array.from(provinceMap.values());
}

/**
 * Generate location codes
 */
function generateCode(type: string, name: string): string {
  const normalized = normalize(name).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `SL-${type}-${normalized}`.substring(0, 50); // Limit length
}

/**
 * Validate CSV data structure and content
 */
export function validateCsvData(csvData: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!csvData || csvData.trim().length === 0) {
    errors.push('CSV data is empty');
    return { isValid: false, errors };
  }

  const lines = csvData.trim().split('\n');
  
  if (lines.length < 2) {
    errors.push('CSV must have at least header and one data row');
    return { isValid: false, errors };
  }

  const header = lines[0];
  const expectedHeaders = ['idregion', 'iddistrict', 'idcouncil', 'idchiefdom', 'idsection', 'idtown'];
  
  for (const expectedHeader of expectedHeaders) {
    if (!header.includes(expectedHeader)) {
      errors.push(`Missing required header: ${expectedHeader}`);
    }
  }

  // Validate data rows - be more lenient with column count for quoted fields
  for (let i = 1; i < Math.min(lines.length, 100); i++) { // Check first 100 rows for performance
    const fields = parseCsvLine(lines[i]);
    
    // Allow some flexibility in column count due to quoted fields with commas
    if (fields.length < 4 || fields.length > 8) {
      errors.push(`Row ${i + 1}: Expected 4-8 columns, got ${fields.length}`);
    }
    
    // Check for empty critical fields (region and town are minimum requirements)
    if (!fields[0]?.trim() || !fields[5]?.trim()) {
      errors.push(`Row ${i + 1}: Missing region or town name`);
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Create search index for fast lookups
 */
export function createSearchIndex(data: Province[]): Map<string, SearchIndexEntry[]> {
  const index = new Map<string, SearchIndexEntry[]>();
  
  // Index all locations by normalized name
  const addToIndex = (item: Province | District | Chiefdom | Town, type: string, record: LocationRecord) => {
    const normalized = normalize(item.name);
    const existing = index.get(normalized) || [];
    existing.push({
      name: item.name,
      type: type as LocationType,
      normalized,
      record,
      searchType: type
    });
    index.set(normalized, existing);

    // Add partial matches
    const words = normalized.split(' ');
    if (words.length > 1) {
      words.forEach(word => {
        if (word.length > 2) {
          const partialExisting = index.get(word) || [];
          partialExisting.push({
            name: item.name,
            type: type as LocationType,
            normalized,
            record,
            partialMatch: true,
            searchType: type
          });
          index.set(word, partialExisting);
        }
      });
    }
  };

  for (const province of data) {
    const provinceRecord = { idregion: province.name, iddistrict: '', idcouncil: '', idchiefdom: '', idsection: '', idtown: '' };
    addToIndex(province, 'province', provinceRecord);
    for (const district of province.districts) {
      const districtRecord = { ...provinceRecord, iddistrict: district.name };
      addToIndex(district, 'district', districtRecord);
      for (const chiefdom of district.chiefdoms) {
        const chiefdomRecord = { ...districtRecord, idchiefdom: chiefdom.name };
        addToIndex(chiefdom, 'chiefdom', chiefdomRecord);
        for (const town of chiefdom.towns) {
          const townRecord = { ...chiefdomRecord, idtown: town.name, idsection: town.section || '', idcouncil: town.council || '' };
          addToIndex(town, 'town', townRecord);
        }
      }
    }
  }
  
  return index;
}

// Legacy function for backward compatibility  
export function processLocationData(data: string | LocationRecord[]): Province[] {
  if (typeof data === 'string') {
    return processCsvToHierarchy(data);
  }
  // Convert LocationRecord[] to Province[] if needed
  return processCsvToHierarchy(''); // This should be refactored to handle LocationRecord[]
}

export function validateLocationData(data: string | LocationRecord[]): boolean {
  if (typeof data === 'string') {
    return validateCsvData(data).isValid;
  }
  return true;
}