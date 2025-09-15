/**
 * Security utilities to prevent common vulnerabilities
 */

export class SecurityValidator {
  private static readonly MAX_INPUT_LENGTH = 200;
  private static readonly MAX_SEARCH_LENGTH = 100;
  private static readonly BLOCKED_PATTERNS = [
    /<script/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\(/gi,
    /expression\(/gi,
    /vbscript:/gi,
    /import\s+/gi,
    /require\s*\(/gi,
    /\.\./gi,  // Path traversal
    /file:/gi,  // File protocol
    /data:/gi,  // Data URLs
    /\bexec\b/gi,  // Execute commands
    /\bsystem\b/gi,  // System calls
    /\bdrop\b/gi,  // SQL DROP
    /\bdelete\b/gi,  // SQL DELETE
    /\bunion\b/gi,  // SQL UNION
    /\bselect\b.*\bfrom\b/gi,  // SQL SELECT
  ];

  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(or|and)\b\s*\d+\s*=\s*\d+)/gi,                    // OR 1=1, AND 1=1
    /'.*\b(or|and)\b.*'/gi,                                 // OR/AND between quotes  
    /(--|#|\/\*|\*\/)/gi,                                  // SQL comments
    /(benchmark|sleep|waitfor|delay)\s*\(/gi,              // Time-based attacks
    /(\bunion\b\s+\bselect\b)/gi,                          // UNION SELECT
    /('\s*;\s*\w+)/gi,                                     // '; DROP, '; DELETE etc
  ];

  /**
   * Validate and sanitize user input with comprehensive protection
   */
  static sanitize(input: unknown): string {
    if (!input) return '';

    // Type check
    if (typeof input !== 'string') {
      throw new TypeError('Input must be a string');
    }

    // Length check
    if (input.length > this.MAX_INPUT_LENGTH) {
      throw new Error(`Input exceeds maximum length of ${this.MAX_INPUT_LENGTH} characters`);
    }

    // Check for SQL injection patterns
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        throw new Error('Input contains SQL injection patterns');
      }
    }

    // Check for malicious patterns
    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(input)) {
        throw new Error('Input contains potentially malicious content');
      }
    }

    // Remove HTML tags, dangerous characters, and normalize
    return input
      .replace(/<[^>]*>/g, '')
      .replace(/[<>'"`;\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Sanitize search queries with additional restrictions
   */
  static sanitizeSearchQuery(query: unknown): string {
    if (!query) return '';

    if (typeof query !== 'string') {
      throw new TypeError('Search query must be a string');
    }

    if (query.length > this.MAX_SEARCH_LENGTH) {
      throw new Error(`Search query exceeds maximum length of ${this.MAX_SEARCH_LENGTH} characters`);
    }

    // Additional search-specific validations
    if (query.length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }

    return this.sanitize(query);
  }

  /**
   * Validate array input with size limits
   */
  static validateArray<T>(arr: unknown, maxLength = 1000): T[] {
    if (!Array.isArray(arr)) {
      throw new TypeError('Input must be an array');
    }

    if (arr.length > maxLength) {
      throw new Error(`Array exceeds maximum length of ${maxLength}`);
    }

    return arr as T[];
  }

  /**
   * Enhanced rate limiting with sliding window
   */
  static checkRateLimit(identifier: string, requests: Map<string, number[]>, maxRequests = 100, windowMs = 60000): boolean {
    const now = Date.now();

    if (!requests.has(identifier)) {
      requests.set(identifier, [now]);
      return true;
    }

    const timestamps = requests.get(identifier)!;
    
    // Clean old timestamps (sliding window)
    const recentRequests = timestamps.filter(t => now - t < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return false;
    }

    recentRequests.push(now);
    requests.set(identifier, recentRequests);
    return true;
  }

  /**
   * Validate CSV data for security issues
   */
  static validateCsvData(csvContent: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!csvContent || typeof csvContent !== 'string') {
      errors.push('CSV content must be a non-empty string');
      return { isValid: false, errors };
    }

    // Check for dangerous content in CSV
    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(csvContent)) {
        errors.push('CSV contains potentially malicious content');
        break;
      }
    }

    // Check for excessively large files (DOS protection)
    if (csvContent.length > 10 * 1024 * 1024) { // 10MB limit
      errors.push('CSV file too large (exceeds 10MB)');
    }

    // Check for suspicious CSV injection patterns
    const csvInjectionPatterns = [
      /^[=@+-]/gm,  // Formula injection
      /^\|/gm,      // Pipe injection
    ];

    for (const pattern of csvInjectionPatterns) {
      if (pattern.test(csvContent)) {
        errors.push('CSV contains formula injection patterns');
        break;
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Escape output for safe display
   */
  static escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Validate object properties against schema
   */
  static validateSchema(obj: Record<string, unknown>, schema: Record<string, string>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, expectedType] of Object.entries(schema)) {
      if (!(key in obj)) {
        errors.push(`Missing required property: ${key}`);
        continue;
      }

      const actualType = typeof obj[key];
      if (actualType !== expectedType) {
        errors.push(`Property ${key} should be ${expectedType}, got ${actualType}`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}

/**
 * Create immutable object
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const value = obj[prop as keyof typeof obj];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  });
  return obj;
}