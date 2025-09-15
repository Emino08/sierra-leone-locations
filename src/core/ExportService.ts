import { ExportFormat, Province, ExportQuery, LocationRecord, District, Chiefdom, Town, PlaceDetails } from '../types';
import { LocationService } from './LocationService';
import { SecurityValidator } from '../utils/security';

export class ExportService {
  private locationService: LocationService;

  constructor() {
    this.locationService = LocationService.getInstance();
  }

  /**
   * Export data in specified format
   */
  async export(format: ExportFormat, query?: ExportQuery): Promise<string | Province[] | LocationRecord[]> {
    SecurityValidator.sanitize(format);

    const data = query
      ? await this.locationService.getLocationsByQuery(query)
      : await this.getAllData();

    switch (format) {
      case 'json':
        return this.exportJSON(data);
      case 'csv':
        return this.exportCSV(data);
      case 'array':
        return this.exportArray(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export as JSON string
   */
  private exportJSON(data: Province[] | LocationRecord[]): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export as CSV string
   */
  private exportCSV(data: Province[] | LocationRecord[]): string {
    if (!data || data.length === 0) return '';

    const rows: string[][] = [];

    // Check if it's LocationRecord array (from query) or Province array (full data)
    if (data.length > 0 && 'idregion' in data[0]) {
      // Handle LocationRecord array
      const locationData = data as LocationRecord[];
      rows.push(['Region ID', 'District ID', 'Council ID', 'Chiefdom ID', 'Section ID', 'Town ID']);
      
      locationData.forEach(item => {
        rows.push([
          item.idregion || '',
          item.iddistrict || '',
          item.idcouncil || '',
          item.idchiefdom || '',
          item.idsection || '',
          item.idtown || ''
        ]);
      });
    } else {
      // Handle Province array (hierarchical data)
      const provinceData = data as Province[];
      rows.push(['Name', 'Type', 'Code', 'Province', 'District', 'Chiefdom', 'Population']);

      const processItem = (item: Province | District | Chiefdom | Town, parentInfo: { province?: string; district?: string; chiefdom?: string } = {}) => {
        const row = [
          item.name || '',
          item.type || '',
          item.code || '',
          parentInfo.province || ('province' in item ? item.province : '') || '',
          parentInfo.district || ('district' in item ? item.district : '') || '',
          parentInfo.chiefdom || ('chiefdom' in item ? item.chiefdom : '') || '',
          ('population' in item ? item.population?.toString() : '') || ''
        ];
        rows.push(row);

        // Process children based on type
        if (item.type === 'province' && 'districts' in item) {
          item.districts.forEach((district: District) => {
            processItem(district, { province: item.name });
          });
        }
        if (item.type === 'district' && 'chiefdoms' in item) {
          item.chiefdoms.forEach((chiefdom: Chiefdom) => {
            processItem(chiefdom, {
              province: parentInfo.province || item.province,
              district: item.name
            });
          });
        }
        if (item.type === 'chiefdom' && 'towns' in item) {
          item.towns.forEach((town: Town) => {
            processItem(town, {
              province: parentInfo.province || item.province,
              district: parentInfo.district || item.district,
              chiefdom: item.name
            });
          });
        }
      };

      provinceData.forEach(item => processItem(item));
    }

    // Convert to CSV string
    return rows.map(row =>
      row.map(cell => {
        // Escape quotes and wrap in quotes if necessary
        const escaped = cell.replace(/"/g, '""');
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
      }).join(',')
    ).join('\n');
  }

  /**
   * Export as array
   */
  private exportArray(data: Province[] | LocationRecord[]): Province[] | LocationRecord[] {
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Get all location data
   */
  private async getAllData(): Promise<Province[]> {
    return await this.locationService.getFullProvinceData();
  }

  /**
   * Export locations by type
   */
  exportByType(type: 'province' | 'district' | 'chiefdom' | 'town', format: ExportFormat = 'json'): Promise<string | Province[] | LocationRecord[]> {
    return this.export(format, { type });
  }

  /**
   * Export hierarchy for a specific location
   */
  async exportHierarchy(locationName: string, format: ExportFormat = 'json'): Promise<string | PlaceDetails[]> {
    const place = await this.locationService.findPlace(locationName);
    if (!place) {
      throw new Error(`Location '${locationName}' not found`);
    }

    return format === 'json'
      ? JSON.stringify(place, null, 2)
      : format === 'array'
      ? [place]
      : this.exportPlaceAsCSV(place);
  }

  /**
   * Export a single place as CSV
   */
  private exportPlaceAsCSV(place: PlaceDetails): string {
    const rows: string[][] = [];
    rows.push(['Name', 'Type', 'Code', 'Province', 'District', 'Chiefdom', 'Population']);
    
    const row = [
      place.name || '',
      place.type || '',
      place.code || '',
      place.province || '',
      place.district || '',
      place.chiefdom || '',
      place.population?.toString() || ''
    ];
    rows.push(row);

    return rows.map(row =>
      row.map(cell => {
        const escaped = cell.replace(/"/g, '""');
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
      }).join(',')
    ).join('\n');
  }
}