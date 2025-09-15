# sierra-leone-locations

A comprehensive npm package providing structured data and utilities for Sierra Leone's administrative and settlement divisions: provinces, districts, chiefdoms, and towns/villages.

## Features

- 🗺️ **Complete hierarchical data** for Sierra Leone's administrative divisions
- 🔍 **Smart search and autocomplete** functionality
- ✅ **Validation utilities** for location names
- 📊 **Multiple export formats** (JSON, CSV, Array)
- 🔒 **Security-first design** with input sanitization
- 🌳 **Tree-shakable** - import only what you need
- 💾 **Offline-first** - no API calls required
- ⚡ **Optimized performance** with built-in caching

## Installation

```bash
npm install sierra-leone-locations
# or
yarn add sierra-leone-locations
```

## Quick Start

```javascript
import SL from 'sierra-leone-locations';

// Get all provinces
const provinces = await SL.getProvinces();
// Returns: ['NORTHERN', 'SOUTHERN', 'EASTERN', 'NORTHWESTERN', 'WESTERN AREA']

// Get districts in a province
const districts = await SL.getDistricts('SOUTHERN');
// Returns: ['BO', 'BONTHE', 'MOYAMBA', 'PUJEHUN']

// Find a place by name
const place = await SL.findPlace('BO');
// Returns: {
//   name: 'BO',
//   type: 'town',
//   code: 'SL-TOWN-BO',
//   province: 'SOUTHERN',
//   district: 'BO',
//   chiefdom: 'KAKUA'
// }

// Autocomplete search
const suggestions = await SL.autocomplete('BO');
// Returns: ['BO', 'BOBA', 'BOBOR', ...]

// Validate location
const result = await SL.isValidDistrict('BO');
// Returns: { isValid: true }
```

## API Reference

### Hierarchical Data Access

#### getProvinces()
Returns an array of all province names.

```javascript
const provinces = await SL.getProvinces();
```

#### getDistricts(provinceName?)
Returns districts. If provinceName is provided, returns districts in that province.

```javascript
const allDistricts = await SL.getDistricts();
const southernDistricts = await SL.getDistricts('SOUTHERN');
```

#### getChiefdoms(districtName)
Returns all chiefdoms in a district.

```javascript
const chiefdoms = await SL.getChiefdoms('BO');
```

#### getTowns(chiefdomName)
Returns all towns/villages in a chiefdom.

```javascript
const towns = await SL.getTowns('KAKUA');
```

### Place Lookup

#### findPlace(name)
Returns detailed information about a location.

```javascript
const place = await SL.findPlace('KENEMA');
// Returns complete details including hierarchy
```

### Search & Autocomplete

#### autocomplete(query, clientId?, limit = 10)
Returns autocomplete suggestions.

```javascript
const suggestions = await SL.autocomplete('BO', 'client-id', 5);
```

#### search(query, options?, clientId?)
Full-text search with scoring.

```javascript
const results = await SL.search('BO', {
  limit: 20,
  minScore: 0.5,
  types: ['town', 'district']
}, 'client-id');
```

### Validation

#### isValidProvince(name)
#### isValidDistrict(name, provinceName?)
#### isValidChiefdom(name, districtName?)
#### isValidTown(name, chiefdomName?)

```javascript
const result = await SL.isValidProvince('NORTHERN');
// Returns: { isValid: true }

const invalid = await SL.isValidDistrict('InvalidName');
// Returns: {
//   isValid: false,
//   message: "'InvalidName' is not a valid district",
//   suggestions: ['BO', 'BONTHE', ...]
// }
```

### Export

#### export(format, query?)
Export data in different formats.

```javascript
// Export all as JSON
const json = await SL.export('json');

// Export as CSV
const csv = await SL.export('csv', { province: 'WESTERN AREA' });

// Export as array
const array = await SL.export('array', { type: 'district' });
```

### Tree-Shaking

Import only what you need:

```javascript
import {
  getProvinces,
  findPlace,
  autocomplete
} from 'sierra-leone-locations';

const provinces = getProvinces();
```

## Location Codes

Each location has a unique hierarchical code:

- Province: `SL-SOUTH`
- District: `SL-SOUTH-BO`
- Chiefdom: `SL-SOUTH-BO-KAKUA`
- Town: `SL-SOUTH-BO-KAKUA-NJALA`

## Security

This package implements several security measures:

- **Input sanitization** - All user inputs are sanitized
- **XSS prevention** - HTML tags and scripts are stripped
- **Injection prevention** - SQL/NoSQL injection patterns are blocked
- **Rate limiting support** - Built-in rate limiting helpers
- **Immutable exports** - API objects are frozen to prevent tampering

## Performance

- **Caching** - Frequently accessed data is cached
- **Lazy loading** - Data is loaded on demand
- **Optimized search** - Indexed search for fast autocomplete
- **Minimal bundle size** - Tree-shakable exports

## Contributing

Contributions are welcome! Please read our Contributing Guide for details.

## Data Quality

- **5,555+ location records** from official sources
- **Hierarchical structure** with 4 administrative levels
- **Regular updates** to maintain data accuracy
- **CSV format** for easy data management and updates

## Browser Support

This package works in all modern browsers and Node.js environments:
- Node.js 18+
- Chrome, Firefox, Safari, Edge (latest versions)
- TypeScript support included

## Bundle Size

- **Minimal footprint** with tree-shaking support
- **~50KB gzipped** for the complete dataset
- **Import only what you need** for smaller bundles

## License

MIT © [Sabiteck](https://github.com/sabiteck)

## Changelog

### v1.0.0
- Initial release with comprehensive Sierra Leone location data
- CSV-based data processing with 5,555+ location records
- Full async API with performance optimization
- Built-in security features and input validation
- Complete test coverage (87 tests)

## Acknowledgments

Data sourced from official Sierra Leone government administrative divisions.# sierra-leone-locations
