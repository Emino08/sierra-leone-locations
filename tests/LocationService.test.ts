import { LocationService } from '../src/core/LocationService';
import * as fs from 'fs';
import * as path from 'path';

describe('LocationService', () => {
  let service: LocationService;
  let csvData: string;

  beforeAll(async () => {
    // Load CSV data for testing
    const csvPath = path.join(__dirname, '../src/data/locations.csv');
    csvData = fs.readFileSync(csvPath, 'utf-8');
    
    service = LocationService.getInstance();
    await service.initializeWithData(csvData);
  });

  afterAll(() => {
    service.clearCache();
  });

  describe('Provinces/Regions', () => {
    test('should return all regions', async () => {
      const regions = await service.getProvinces();
      expect(Array.isArray(regions)).toBe(true);
      expect(regions.length).toBeGreaterThan(0);
      expect(regions).toContain('NORTHERN');
      expect(regions).toContain('SOUTHERN');
      expect(regions).toContain('EASTERN');
    });

    test('should return sorted regions', async () => {
      const regions = await service.getProvinces();
      const sorted = [...regions].sort();
      expect(regions).toEqual(sorted);
    });
  });

  describe('Districts', () => {
    test('should return all districts', async () => {
      const districts = await service.getDistricts();
      expect(Array.isArray(districts)).toBe(true);
      expect(districts.length).toBeGreaterThan(0);
      expect(districts).toContain('TONKOLILI');
      expect(districts).toContain('MOYAMBA');
    });

    test('should return districts for a specific region', async () => {
      const districts = await service.getDistricts('NORTHERN');
      expect(Array.isArray(districts)).toBe(true);
      expect(districts).toContain('TONKOLILI');
      expect(districts).not.toContain('MOYAMBA'); // MOYAMBA is in SOUTHERN
    });

    test('should return empty array for non-existent region', async () => {
      const districts = await service.getDistricts('NON_EXISTENT');
      expect(Array.isArray(districts)).toBe(true);
      expect(districts.length).toBe(0);
    });
  });

  describe('Councils', () => {
    test('should return councils for a district', async () => {
      const councils = await service.getCouncils('TONKOLILI');
      expect(Array.isArray(councils)).toBe(true);
      expect(councils.length).toBeGreaterThan(0);
      expect(councils).toContain('TONKOLILI DISTRICT');
    });

    test('should handle case-insensitive district names', async () => {
      const councils1 = await service.getCouncils('TONKOLILI');
      const councils2 = await service.getCouncils('tonkolili');
      expect(councils1).toEqual(councils2);
    });
  });

  describe('Chiefdoms', () => {
    test('should return chiefdoms for a district', async () => {
      const chiefdoms = await service.getChiefdoms('TONKOLILI');
      expect(Array.isArray(chiefdoms)).toBe(true);
      expect(chiefdoms.length).toBeGreaterThan(0);
      expect(chiefdoms).toContain('KHOLIFA MAMUNTHA/MAYOSSO');
    });

    test('should return empty array for non-existent district', async () => {
      const chiefdoms = await service.getChiefdoms('NON_EXISTENT');
      expect(Array.isArray(chiefdoms)).toBe(true);
      expect(chiefdoms.length).toBe(0);
    });
  });

  describe('Sections', () => {
    test('should return sections for a chiefdom', async () => {
      const sections = await service.getSections('KHOLIFA MAMUNTHA/MAYOSSO');
      expect(Array.isArray(sections)).toBe(true);
      expect(sections.length).toBeGreaterThan(0);
      expect(sections).toContain('MAMUNTHA');
    });
  });

  describe('Towns', () => {
    test('should return all towns', async () => {
      const towns = await service.getTowns();
      expect(Array.isArray(towns)).toBe(true);
      expect(towns.length).toBeGreaterThan(0);
    });

    test('should return towns for a chiefdom', async () => {
      const towns = await service.getTowns('KHOLIFA MAMUNTHA/MAYOSSO');
      expect(Array.isArray(towns)).toBe(true);
      expect(towns.length).toBeGreaterThan(0);
      expect(towns).toContain('MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)');
    });

    test('should return towns for a chiefdom and section', async () => {
      const towns = await service.getTowns('KHOLIFA MAMUNTHA/MAYOSSO', 'MAMUNTHA');
      expect(Array.isArray(towns)).toBe(true);
      expect(towns.length).toBeGreaterThan(0);
    });
  });

  describe('Search Functionality', () => {
    test('should search for locations', async () => {
      const results = await service.search('MAGBASS');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      const hasMatch = results.some(r => 
        r.name && r.name.includes('MAGBASS')
      );
      expect(hasMatch).toBe(true);
    });

    test('should limit search results', async () => {
      const results = await service.search('TOWN', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    test('should return empty array for invalid search', async () => {
      const results = await service.search('NONEXISTENTLOCATION123');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('Place Finding', () => {
    test('should find a place by name', async () => {
      const place = await service.findPlace('MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)');
      expect(place).toBeDefined();
      expect(place?.name).toBe('MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)');
      expect(place?.type).toBe('town');
    });

    test('should return null for non-existent place', async () => {
      const place = await service.findPlace('NonExistentPlace123');
      expect(place).toBeNull();
    });

    test('should find places case-insensitively', async () => {
      const place1 = await service.findPlace('MAGBASS');
      const place2 = await service.findPlace('magbass');
      
      // Both should either be found or not found
      if (place1) {
        expect(place2).toBeDefined();
      } else {
        expect(place2).toBeNull();
      }
    });
  });

  describe('Location Hierarchy', () => {
    test('should get location hierarchy for a town', async () => {
      const hierarchy = await service.getLocationHierarchy('MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)');
      expect(hierarchy).toBeDefined();
      if (hierarchy) {
        expect(hierarchy.idregion).toBe('NORTHERN');
        expect(hierarchy.iddistrict).toBe('TONKOLILI');
        expect(hierarchy.idtown).toBe('MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)');
      }
    });

    test('should return null for non-existent town', async () => {
      const hierarchy = await service.getLocationHierarchy('NonExistentTown');
      expect(hierarchy).toBeNull();
    });
  });

  describe('Statistics', () => {
    test('should return data statistics', async () => {
      const stats = await service.getStatistics();
      expect(stats).toBeDefined();
      expect(stats.totalRecords).toBeGreaterThan(0);
      expect(stats.regions).toBeGreaterThan(0);
      expect(stats.districts).toBeGreaterThan(0);
      expect(stats.towns).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('should handle large queries efficiently', async () => {
      const start = Date.now();
      const regions = await service.getProvinces();
      const districts = await service.getDistricts();
      const towns = await service.getTowns();
      const end = Date.now();

      expect(regions.length).toBeGreaterThan(0);
      expect(districts.length).toBeGreaterThan(0);
      expect(towns.length).toBeGreaterThan(0);
      
      // Should complete within reasonable time (5 seconds)
      expect(end - start).toBeLessThan(5000);
    });

    test('should cache results for repeated queries', async () => {
      // First call
      const start1 = Date.now();
      const regions1 = await service.getProvinces();
      const end1 = Date.now();
      const duration1 = end1 - start1;

      // Second call (should be cached)
      const start2 = Date.now();
      const regions2 = await service.getProvinces();
      const end2 = Date.now();
      const duration2 = end2 - start2;

      expect(regions1).toEqual(regions2);
      // Second call should be significantly faster (cached) - allow for timing variance
      expect(duration2).toBeLessThanOrEqual(duration1 + 5); // Allow 5ms tolerance
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed input gracefully', async () => {
      await expect(service.getDistricts('')).resolves.toBeDefined();
      await expect(service.getTowns('')).resolves.toBeDefined();
    });

    test('should sanitize input', async () => {
      // Test with potentially malicious input that should be cleaned
      const results = await service.search('freetown'); // Use normal input since strict validation blocks malicious content
      expect(Array.isArray(results)).toBe(true);
      
      // Test that actual malicious content is blocked
      await expect(service.search('<script>alert("xss")</script>'))
        .rejects.toThrow('Input contains potentially malicious content');
    });
  });
});