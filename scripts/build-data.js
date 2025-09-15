import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Enhanced data processing with security and performance optimizations
 */
class DataProcessor {
  constructor() {
    this.csvPath = path.join(__dirname, '../src/data/locations.csv');
    this.outputPath = path.join(__dirname, '../src/data/locations.json');
    this.stats = {
      totalRecords: 0,
      regions: new Set(),
      districts: new Set(),
      councils: new Set(),
      chiefdoms: new Set(),
      sections: new Set(),
      towns: new Set(),
      errors: []
    };
  }

  /**
   * Validate and sanitize CSV data
   */
  validateCSVData(csvContent) {
    const errors = [];
    
    if (!csvContent || typeof csvContent !== 'string') {
      errors.push('CSV content is invalid');
      return { isValid: false, errors };
    }

    // Check for dangerous content
    const dangerousPatterns = [
      /<script/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\(/gi,
      /\.\./gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(csvContent)) {
        errors.push('CSV contains potentially dangerous content');
        break;
      }
    }

    // Check file size (10MB limit)
    if (csvContent.length > 10 * 1024 * 1024) {
      errors.push('CSV file too large (exceeds 10MB)');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Parse CSV data manually for better control
   */
  parseCSV(csvContent) {
    const lines = csvContent.trim().split('\n');
    const [header, ...dataLines] = lines;

    if (!header || !header.includes('idregion')) {
      throw new Error('Invalid CSV format: missing required headers');
    }

    const records = [];
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      const columns = line.split(',');
      if (columns.length !== 6) {
        this.stats.errors.push(`Row ${i + 2}: Expected 6 columns, got ${columns.length}`);
        continue;
      }

      const [idregion, iddistrict, idcouncil, idchiefdom, idsection, idtown] = columns;
      
      // Sanitize and validate each field
      const record = {
        idregion: this.sanitizeField(idregion),
        iddistrict: this.sanitizeField(iddistrict),
        idcouncil: this.sanitizeField(idcouncil),
        idchiefdom: this.sanitizeField(idchiefdom),
        idsection: this.sanitizeField(idsection),
        idtown: this.sanitizeField(idtown)
      };

      // Skip records with missing critical data
      if (!record.idregion || !record.idtown) {
        this.stats.errors.push(`Row ${i + 2}: Missing region or town`);
        continue;
      }

      records.push(record);
      this.updateStats(record);
    }

    return records;
  }

  /**
   * Sanitize field data
   */
  sanitizeField(field) {
    if (!field) return '';
    
    return field
      .trim()
      .replace(/[<>'"`;\\]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 200); // Limit length
  }

  /**
   * Update statistics during processing
   */
  updateStats(record) {
    this.stats.totalRecords++;
    this.stats.regions.add(record.idregion);
    this.stats.districts.add(record.iddistrict);
    this.stats.councils.add(record.idcouncil);
    this.stats.chiefdoms.add(record.idchiefdom);
    this.stats.sections.add(record.idsection);
    this.stats.towns.add(record.idtown);
  }

  /**
   * Build hierarchical structure from flat records
   */
  buildHierarchy(records) {
    const provinceMap = new Map();

    records.forEach(record => {
      // Create/get province
      if (!provinceMap.has(record.idregion)) {
        provinceMap.set(record.idregion, {
          name: record.idregion,
          type: 'province',
          code: this.generateCode('PROVINCE', record.idregion),
          districts: new Map()
        });
      }
      const province = provinceMap.get(record.idregion);

      // Create/get district
      if (!province.districts.has(record.iddistrict)) {
        province.districts.set(record.iddistrict, {
          name: record.iddistrict,
          type: 'district',
          code: this.generateCode('DISTRICT', record.iddistrict),
          province: record.idregion,
          provinceCode: province.code,
          chiefdoms: new Map()
        });
      }
      const district = province.districts.get(record.iddistrict);

      // Create/get chiefdom
      if (!district.chiefdoms.has(record.idchiefdom)) {
        district.chiefdoms.set(record.idchiefdom, {
          name: record.idchiefdom,
          type: 'chiefdom',
          code: this.generateCode('CHIEFDOM', record.idchiefdom),
          district: record.iddistrict,
          districtCode: district.code,
          province: record.idregion,
          provinceCode: province.code,
          towns: []
        });
      }
      const chiefdom = district.chiefdoms.get(record.idchiefdom);

      // Add town
      chiefdom.towns.push({
        name: record.idtown,
        type: 'town',
        code: this.generateCode('TOWN', record.idtown),
        chiefdom: record.idchiefdom,
        chiefdomCode: chiefdom.code,
        district: record.iddistrict,
        districtCode: district.code,
        province: record.idregion,
        provinceCode: province.code,
        section: record.idsection,
        council: record.idcouncil
      });
    });

    // Convert Maps to arrays for JSON serialization
    return Array.from(provinceMap.values()).map(province => ({
      ...province,
      districts: Array.from(province.districts.values()).map(district => ({
        ...district,
        chiefdoms: Array.from(district.chiefdoms.values())
      }))
    }));
  }

  /**
   * Generate location codes
   */
  generateCode(type, name) {
    const normalized = name.toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 20);
    return `SL-${type}-${normalized}`;
  }

  /**
   * Process CSV and generate JSON
   */
  async processData() {
    try {
      console.log('🔄 Processing CSV data...');

      // Read CSV file
      if (!fs.existsSync(this.csvPath)) {
        throw new Error(`CSV file not found: ${this.csvPath}`);
      }

      const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
      
      // Validate CSV
      const validation = this.validateCSVData(csvContent);
      if (!validation.isValid) {
        throw new Error(`CSV validation failed: ${validation.errors.join(', ')}`);
      }

      // Parse CSV
      const records = this.parseCSV(csvContent);
      console.log(`📊 Parsed ${records.length} records`);

      // Build hierarchy
      const hierarchy = this.buildHierarchy(records);
      
      // Ensure output directory exists
      const outputDir = path.dirname(this.outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write JSON file
      const jsonData = {
        metadata: {
          generatedAt: new Date().toISOString(),
          version: '2.0.0',
          source: 'locations.csv',
          statistics: {
            totalRecords: this.stats.totalRecords,
            regions: this.stats.regions.size,
            districts: this.stats.districts.size,
            councils: this.stats.councils.size,
            chiefdoms: this.stats.chiefdoms.size,
            sections: this.stats.sections.size,
            towns: this.stats.towns.size,
            errors: this.stats.errors.length
          }
        },
        data: hierarchy
      };

      fs.writeFileSync(this.outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
      
      // Log results
      console.log('✅ Data processing completed successfully!');
      console.log(`📈 Statistics:`);
      console.log(`   - Total Records: ${this.stats.totalRecords}`);
      console.log(`   - Regions: ${this.stats.regions.size}`);
      console.log(`   - Districts: ${this.stats.districts.size}`);
      console.log(`   - Councils: ${this.stats.councils.size}`);
      console.log(`   - Chiefdoms: ${this.stats.chiefdoms.size}`);
      console.log(`   - Sections: ${this.stats.sections.size}`);
      console.log(`   - Towns: ${this.stats.towns.size}`);
      
      if (this.stats.errors.length > 0) {
        console.log(`⚠️  Errors encountered: ${this.stats.errors.length}`);
        this.stats.errors.slice(0, 10).forEach(error => {
          console.log(`   - ${error}`);
        });
        if (this.stats.errors.length > 10) {
          console.log(`   ... and ${this.stats.errors.length - 10} more`);
        }
      }

      console.log(`💾 Output written to: ${this.outputPath}`);
      
      return jsonData;
    } catch (error) {
      console.error('❌ Data processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate sample CSV for testing
   */
  generateSampleCSV() {
    const sampleData = `idregion,iddistrict,idcouncil,idchiefdom,idsection,idtown
NORTHERN,TONKOLILI,TONKOLILI DISTRICT,KHOLIFA MAMUNTHA/MAYOSSO,MAMUNTHA,MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)
NORTHERN,TONKOLILI,TONKOLILI DISTRICT,KHOLIFA MAMUNTHA/MAYOSSO,MAMUNTHA SECTION,MAGBASS VILLAGE (KHOLIFA MAMUNTHA/MAYOSSO)
SOUTHERN,MOYAMBA,MOYAMBA DISTRICT,KAGBORO,MAMBO,MOKONGBETTY (KAGBORO)
EASTERN,KONO,KONO DISTRICT,NIMIYAMA,BAFINFEH,CONDAMA (NIMIYAMA)
WESTERN,WESTERN AREA RURAL,WESTERN AREA RURAL DISTRICT,MOUNTAIN RURAL,HILL STATION,NAVO DRIVE (MOUNTAIN RURAL)`;

    const samplePath = path.join(__dirname, '../src/data/sample-locations.csv');
    fs.writeFileSync(samplePath, sampleData, 'utf-8');
    console.log(`📝 Sample CSV generated: ${samplePath}`);
    return samplePath;
  }
}

// Main execution - always run when script is called directly
console.log('🚀 Starting data processing...');
const processor = new DataProcessor();
processor.processData()
  .then(() => {
    console.log('✅ Data processing completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Process failed:', error);
    process.exit(1);
  });

export default DataProcessor;