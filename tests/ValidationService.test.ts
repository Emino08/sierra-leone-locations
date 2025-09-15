import { ValidationService } from '../src/core/ValidationService';
import * as fs from 'fs';
import * as path from 'path';

describe('ValidationService', () => {
  let service: ValidationService;
  let csvData: string;

  beforeAll(async () => {
    // Load CSV data for testing
    const csvPath = path.join(__dirname, '../src/data/locations.csv');
    csvData = fs.readFileSync(csvPath, 'utf-8');
    
    service = new ValidationService();
    await service.initialize(csvData);
  });

  describe('Region Validation', () => {
    test('should validate valid region', async () => {
      const result = await service.isValidRegion('NORTHERN');
      expect(result.isValid).toBe(true);
    });

    test('should invalidate invalid region', async () => {
      const result = await service.isValidRegion('INVALID_REGION');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('not a valid region');
    });

    test('should handle case-insensitive validation', async () => {
      const result1 = await service.isValidRegion('NORTHERN');
      const result2 = await service.isValidRegion('northern');
      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(true);
    });

    test('should provide suggestions for invalid regions', async () => {
      const result = await service.isValidRegion('NORTHER');
      expect(result.isValid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe('District Validation', () => {
    test('should validate valid district', async () => {
      const result = await service.isValidDistrict('TONKOLILI', 'NORTHERN');
      expect(result.isValid).toBe(true);
    });

    test('should invalidate invalid district', async () => {
      const result = await service.isValidDistrict('INVALID_DISTRICT', 'NORTHERN');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('not a valid district');
    });

    test('should validate district without region context', async () => {
      const result = await service.isValidDistrict('TONKOLILI');
      expect(result.isValid).toBe(true);
    });

    test('should invalidate district in wrong region', async () => {
      const result = await service.isValidDistrict('TONKOLILI', 'SOUTHERN');
      expect(result.isValid).toBe(false);
    });

    test('should provide suggestions for invalid districts', async () => {
      const result = await service.isValidDistrict('TONKOLI');
      expect(result.isValid).toBe(false);
      expect(result.suggestions).toBeDefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe('Council Validation', () => {
    test('should validate valid council', async () => {
      const result = await service.isValidCouncil('TONKOLILI DISTRICT', 'TONKOLILI');
      expect(result.isValid).toBe(true);
    });

    test('should invalidate invalid council', async () => {
      const result = await service.isValidCouncil('INVALID_COUNCIL', 'TONKOLILI');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('not a valid council');
    });

    test('should require district for council validation', async () => {
      const result = await service.isValidCouncil('TONKOLILI DISTRICT', 'NONEXISTENT_DISTRICT');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Chiefdom Validation', () => {
    test('should validate valid chiefdom', async () => {
      const result = await service.isValidChiefdom('KHOLIFA MAMUNTHA/MAYOSSO', 'TONKOLILI');
      expect(result.isValid).toBe(true);
    });

    test('should invalidate invalid chiefdom', async () => {
      const result = await service.isValidChiefdom('INVALID_CHIEFDOM', 'TONKOLILI');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('not a valid chiefdom');
    });

    test('should validate chiefdom in correct district only', async () => {
      const result = await service.isValidChiefdom('KHOLIFA MAMUNTHA/MAYOSSO', 'MOYAMBA');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Section Validation', () => {
    test('should validate valid section', async () => {
      const result = await service.isValidSection('MAMUNTHA', 'KHOLIFA MAMUNTHA/MAYOSSO');
      expect(result.isValid).toBe(true);
    });

    test('should invalidate invalid section', async () => {
      const result = await service.isValidSection('INVALID_SECTION', 'KHOLIFA MAMUNTHA/MAYOSSO');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('not a valid section');
    });
  });

  describe('Town Validation', () => {
    test('should validate valid town', async () => {
      const result = await service.isValidTown('MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)');
      expect(result.isValid).toBe(true);
    });

    test('should validate town with chiefdom context', async () => {
      const result = await service.isValidTown(
        'MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)',
        'KHOLIFA MAMUNTHA/MAYOSSO'
      );
      expect(result.isValid).toBe(true);
    });

    test('should validate town with chiefdom and section context', async () => {
      const result = await service.isValidTown(
        'MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)',
        'KHOLIFA MAMUNTHA/MAYOSSO',
        'MAMUNTHA'
      );
      expect(result.isValid).toBe(true);
    });

    test('should invalidate invalid town', async () => {
      const result = await service.isValidTown('INVALID_TOWN');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('not a valid town');
    });

    test('should invalidate town in wrong context', async () => {
      const result = await service.isValidTown(
        'MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)',
        'WRONG_CHIEFDOM'
      );
      expect(result.isValid).toBe(false);
    });
  });

  describe('Location Hierarchy Validation', () => {
    test('should validate complete valid hierarchy', async () => {
      const result = await service.validateLocationHierarchy({
        region: 'NORTHERN',
        district: 'TONKOLILI',
        council: 'TONKOLILI DISTRICT',
        chiefdom: 'KHOLIFA MAMUNTHA/MAYOSSO',
        section: 'MAMUNTHA',
        town: 'MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)'
      });
      expect(result.isValid).toBe(true);
    });

    test('should invalidate inconsistent hierarchy', async () => {
      const result = await service.validateLocationHierarchy({
        region: 'NORTHERN',
        district: 'MOYAMBA', // MOYAMBA is in SOUTHERN, not NORTHERN
        town: 'SOME_TOWN'
      });
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('not a valid district in NORTHERN');
    });

    test('should validate partial hierarchy', async () => {
      const result = await service.validateLocationHierarchy({
        region: 'NORTHERN',
        district: 'TONKOLILI'
      });
      expect(result.isValid).toBe(true);
    });

    test('should collect multiple errors', async () => {
      const result = await service.validateLocationHierarchy({
        region: 'INVALID_REGION',
        district: 'INVALID_DISTRICT',
        town: 'INVALID_TOWN'
      });
      expect(result.isValid).toBe(false);
      expect(result.message).toBeDefined();
      expect(result.message!.split(';').length).toBeGreaterThan(1);
    });
  });

  describe('Batch Validation', () => {
    test('should validate batch of regions', async () => {
      const locations = ['NORTHERN', 'SOUTHERN', 'EASTERN'];
      const results = await service.validateBatch(locations, 'region');
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });
    });

    test('should validate batch with mixed valid/invalid items', async () => {
      const locations = ['NORTHERN', 'INVALID_REGION', 'SOUTHERN'];
      const results = await service.validateBatch(locations, 'region');
      
      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
    });

    test('should validate batch of districts', async () => {
      const locations = ['TONKOLILI', 'MOYAMBA', 'KONO'];
      const results = await service.validateBatch(locations, 'district');
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });
    });

    test('should validate batch of towns', async () => {
      const locations = [
        'MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)',
        'MOKONGBETTY (KAGBORO)',
        'INVALID_TOWN'
      ];
      const results = await service.validateBatch(locations, 'town');
      
      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
    });
  });

  describe('Security', () => {
    test('should handle malicious input in validation', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        "'; DROP TABLE locations; --",
        "' OR '1'='1",
        '../../../etc/passwd'
      ];

      for (const input of maliciousInputs) {
        const result = await service.isValidRegion(input);
        expect(result.isValid).toBe(false);
        // Should not throw errors
      }
    });

    test('should sanitize input parameters', async () => {
      const result = await service.isValidDistrict(
        '<img src="x" onerror="alert(1)">',
        'NORTHERN'
      );
      expect(result.isValid).toBe(false);
      // Should handle gracefully without throwing
    });

    test('should reject overly long input', async () => {
      const longInput = 'A'.repeat(200);
      
      await expect(
        service.isValidRegion(longInput)
      ).resolves.toMatchObject({
        isValid: false
      });
    });
  });

  describe('Performance', () => {
    test('should handle concurrent validations efficiently', async () => {
      const promises = [
        service.isValidRegion('NORTHERN'),
        service.isValidDistrict('TONKOLILI'),
        service.isValidTown('MAGBASS (KHOLIFA MAMUNTHA/MAYOSSO)'),
        service.isValidRegion('SOUTHERN'),
        service.isValidDistrict('MOYAMBA')
      ];

      const start = Date.now();
      const results = await Promise.all(promises);
      const end = Date.now();

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });

      // Should complete within reasonable time
      expect(end - start).toBeLessThan(1000);
    });

    test('should handle large batch validations efficiently', async () => {
      const locations = Array(50).fill('NORTHERN');
      
      const start = Date.now();
      const results = await service.validateBatch(locations, 'region');
      const end = Date.now();

      expect(results).toHaveLength(50);
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });

      // Should complete within reasonable time
      expect(end - start).toBeLessThan(2000);
    });
  });

  describe('Error Handling', () => {
    test('should handle empty input gracefully', async () => {
      const result = await service.isValidRegion('');
      expect(result.isValid).toBe(false);
    });

    test('should handle null/undefined input gracefully', async () => {
      // These should not throw but return validation errors
      await expect(service.isValidRegion(null as any)).resolves.toBeDefined();
      await expect(service.isValidRegion(undefined as any)).resolves.toBeDefined();
    });

    test('should handle whitespace-only input', async () => {
      const result = await service.isValidRegion('   ');
      expect(result.isValid).toBe(false);
    });
  });
});