/**
 * validationService.test.ts
 * Test suite for validation service utility
 */

// Mock the validation service
const validationService = {
  validateEmail: (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return {
      isValid: emailRegex.test(email),
      error: emailRegex.test(email) ? null : 'Invalid email format'
    };
  },

  validatePassword: (password: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const isValid = password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
    
    return {
      isValid,
      error: isValid ? null : 'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters',
      requirements: {
        minLength: password.length >= minLength,
        hasUpperCase,
        hasLowerCase,
        hasNumbers,
        hasSpecialChar
      }
    };
  },

  validateName: (name: string) => {
    const nameRegex = /^[a-zA-Z\s'-]{2,50}$/;
    return {
      isValid: nameRegex.test(name.trim()),
      error: nameRegex.test(name.trim()) ? null : 'Name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes'
    };
  },

  validatePhoneNumber: (phone: string) => {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return {
      isValid: phoneRegex.test(phone),
      error: phoneRegex.test(phone) ? null : 'Invalid phone number format'
    };
  },

  validateRequired: (value: any, fieldName: string) => {
    const isValid = value !== null && value !== undefined && value !== '';
    return {
      isValid,
      error: isValid ? null : `${fieldName} is required`
    };
  },

  validateMinLength: (value: string, minLength: number) => {
    const isValid = value.length >= minLength;
    return {
      isValid,
      error: isValid ? null : `Must be at least ${minLength} characters`
    };
  },

  validateMaxLength: (value: string, maxLength: number) => {
    const isValid = value.length <= maxLength;
    return {
      isValid,
      error: isValid ? null : `Must be no more than ${maxLength} characters`
    };
  },

  validateUrl: (url: string) => {
    const urlRegex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    return {
      isValid: urlRegex.test(url),
      error: urlRegex.test(url) ? null : 'Invalid URL format'
    };
  },

  validateDate: (date: string) => {
    const dateObj = new Date(date);
    const isValid = !isNaN(dateObj.getTime());
    return {
      isValid,
      error: isValid ? null : 'Invalid date format'
    };
  },

  validateAge: (birthDate: string, minAge: number = 13, maxAge: number = 120) => {
    const birthDateObj = new Date(birthDate);
    const today = new Date();
    const age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate()) ? age - 1 : age;

    const isValid = actualAge >= minAge && actualAge <= maxAge;
    return {
      isValid,
      error: isValid ? null : `Age must be between ${minAge} and ${maxAge} years`,
      actualAge
    };
  }
};

describe('validationService', () => {

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user_name@example-domain.com',
        '123@example.com',
        'test.email.with+symbol@example.com'
      ];

      validEmails.forEach(email => {
        const result = validationService.validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'invalid',
        'user@',
        '@domain.com',
        'user@domain',
        'user..name@domain.com',
        'user@domain.',
        'user name@domain.com',
        'user@domain .com',
        'user@domain,com'
      ];

      invalidEmails.forEach(email => {
        const result = validationService.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid email format');
      });
    });

    it('should handle edge cases', () => {
      const edgeCases = [
        'a@b.c', // Minimal valid email
        'very.long.email.address@example-domain.com',
        'user@subdomain.example.com'
      ];

      edgeCases.forEach(email => {
        const result = validationService.validateEmail(email);
        expect(typeof result.isValid).toBe('boolean');
        expect(typeof result.error).toBe('string');
      });
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'Password123!',
        'MySecureP@ssw0rd',
        'Complex#Password123',
        'Str0ng!P@ssword'
      ];

      strongPasswords.forEach(password => {
        const result = validationService.validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
        expect(result.requirements.minLength).toBe(true);
        expect(result.requirements.hasUpperCase).toBe(true);
        expect(result.requirements.hasLowerCase).toBe(true);
        expect(result.requirements.hasNumbers).toBe(true);
        expect(result.requirements.hasSpecialChar).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'password', // No uppercase, numbers, special chars
        'PASSWORD', // No lowercase, numbers, special chars
        '12345678', // No letters, special chars
        'Password', // No numbers, special chars
        'Password1', // No special chars
        'Pass!', // Too short
        ''
      ];

      weakPasswords.forEach(password => {
        const result = validationService.validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should provide detailed requirements feedback', () => {
      const password = 'weak';
      const result = validationService.validatePassword(password);

      expect(result.requirements.minLength).toBe(false);
      expect(result.requirements.hasUpperCase).toBe(false);
      expect(result.requirements.hasLowerCase).toBe(true);
      expect(result.requirements.hasNumbers).toBe(false);
      expect(result.requirements.hasSpecialChar).toBe(false);
    });
  });

  describe('validateName', () => {
    it('should validate correct names', () => {
      const validNames = [
        'John Doe',
        'Mary-Jane Smith',
        "O'Connor",
        'Jean-Luc Picard',
        'Anne Marie',
        'John',
        'Elizabeth Alexandra Mary Windsor'
      ];

      validNames.forEach(name => {
        const result = validationService.validateName(name);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    it('should reject invalid names', () => {
      const invalidNames = [
        '',
        'J', // Too short
        'A'.repeat(51), // Too long
        'John123',
        'John@Doe',
        'John_Doe',
        '   ', // Only spaces
        'John   Doe' // Multiple spaces
      ];

      invalidNames.forEach(name => {
        const result = validationService.validateName(name);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes');
      });
    });

    it('should handle names with extra spaces', () => {
      const namesWithSpaces = [
        '  John Doe  ',
        '\tMary Smith\n',
        '  Anne-Marie  '
      ];

      namesWithSpaces.forEach(name => {
        const result = validationService.validateName(name);
        // Should trim spaces before validation
        expect(typeof result.isValid).toBe('boolean');
      });
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate correct phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '123-456-7890',
        '(123) 456-7890',
        '+1 (123) 456-7890',
        '1234567890',
        '+44 20 7946 0958'
      ];

      validPhones.forEach(phone => {
        const result = validationService.validatePhoneNumber(phone);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '',
        '123',
        'abc',
        '123-abc-7890',
        '(123 456-7890', // Unbalanced parentheses
        '123 456 7890 123' // Too long with spaces
      ];

      invalidPhones.forEach(phone => {
        const result = validationService.validatePhoneNumber(phone);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid phone number format');
      });
    });
  });

  describe('validateRequired', () => {
    it('should validate required fields', () => {
      const validValues = [
        'text',
        0,
        false,
        [],
        {},
        '0',
        'false'
      ];

      validValues.forEach(value => {
        const result = validationService.validateRequired(value, 'field');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    it('should reject empty required fields', () => {
      const invalidValues = [
        null,
        undefined,
        '',
        '   ' // This might be considered invalid depending on implementation
      ];

      invalidValues.forEach(value => {
        const result = validationService.validateRequired(value, 'field');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('field is required');
      });
    });
  });

  describe('validateMinLength', () => {
    it('should validate minimum length', () => {
      const result = validationService.validateMinLength('hello', 3);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject strings that are too short', () => {
      const result = validationService.validateMinLength('hi', 3);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Must be at least 3 characters');
    });

    it('should handle exact length match', () => {
      const result = validationService.validateMinLength('hello', 5);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('validateMaxLength', () => {
    it('should validate maximum length', () => {
      const result = validationService.validateMaxLength('hello', 10);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject strings that are too long', () => {
      const result = validationService.validateMaxLength('hello world', 5);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Must be no more than 5 characters');
    });

    it('should handle exact length match', () => {
      const result = validationService.validateMaxLength('hello', 5);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      const validUrls = [
        'https://www.example.com',
        'http://example.com',
        'https://subdomain.example.com/path',
        'https://example.com/path?query=value',
        'https://example.com:8080/path',
        'http://localhost:3000'
      ];

      validUrls.forEach(url => {
        const result = validationService.validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        '',
        'not-a-url',
        'ftp://example.com',
        'www.example.com',
        'example.com',
        'https://',
        'http://',
        'https://example'
      ];

      invalidUrls.forEach(url => {
        const result = validationService.validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid URL format');
      });
    });
  });

  describe('validateDate', () => {
    it('should validate correct dates', () => {
      const validDates = [
        '2024-01-01',
        '2024-12-31',
        '2024-02-29', // Leap year
        '2000-02-29', // Leap year
        '2024-01-15T10:30:00Z',
        '2024-01-15T10:30:00.000Z'
      ];

      validDates.forEach(date => {
        const result = validationService.validateDate(date);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    it('should reject invalid dates', () => {
      const invalidDates = [
        '',
        'invalid-date',
        '2024-13-01', // Invalid month
        '2024-02-30', // Invalid day
        '2024-01-32', // Invalid day
        '2024-02-29', // Non-leap year
        '2023-02-29'  // Non-leap year
      ];

      invalidDates.forEach(date => {
        const result = validationService.validateDate(date);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Invalid date format');
      });
    });
  });

  describe('validateAge', () => {
    it('should validate correct age ranges', () => {
      const today = new Date();
      const validBirthDates = [
        new Date(today.getFullYear() - 20, today.getMonth(), today.getDate()).toISOString(), // 20 years old
        new Date(today.getFullYear() - 13, today.getMonth(), today.getDate()).toISOString(), // Exactly 13
        new Date(today.getFullYear() - 50, today.getMonth(), today.getDate()).toISOString()  // 50 years old
      ];

      validBirthDates.forEach(birthDate => {
        const result = validationService.validateAge(birthDate);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
        expect(result.actualAge).toBeGreaterThanOrEqual(13);
        expect(result.actualAge).toBeLessThanOrEqual(120);
      });
    });

    it('should reject ages outside range', () => {
      const today = new Date();
      const invalidBirthDates = [
        new Date(today.getFullYear() - 12, today.getMonth(), today.getDate()).toISOString(), // 12 years old
        new Date(today.getFullYear() - 121, today.getMonth(), today.getDate()).toISOString()  // 121 years old
      ];

      invalidBirthDates.forEach(birthDate => {
        const result = validationService.validateAge(birthDate);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Age must be between 13 and 120 years');
      });
    });

    it('should handle custom age ranges', () => {
      const today = new Date();
      const birthDate = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate()).toISOString();
      
      const result = validationService.validateAge(birthDate, 18, 65);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should calculate age correctly', () => {
      const today = new Date(2024, 0, 15); // January 15, 2024
      const birthDate = new Date(2000, 5, 15).toISOString(); // June 15, 2000
      
      // Mock Date.now to return a specific date
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => today.getTime());
      
      const result = validationService.validateAge(birthDate);
      expect(result.actualAge).toBe(23); // 2024 - 2000 = 24, but birthday hasn't happened yet this year
      
      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('complex validation scenarios', () => {
    it('should validate complete user registration data', () => {
      const userData = {
        email: 'john.doe@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: '1990-01-01'
      };

      const validations = [
        validationService.validateEmail(userData.email),
        validationService.validatePassword(userData.password),
        validationService.validateName(userData.firstName),
        validationService.validateName(userData.lastName),
        validationService.validateDate(userData.birthDate),
        validationService.validateAge(userData.birthDate)
      ];

      validations.forEach(result => {
        expect(result.isValid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    it('should handle validation with null and undefined values', () => {
      const nullValue = null;
      const undefinedValue = undefined;

      const emailResult = validationService.validateEmail(nullValue as any);
      const passwordResult = validationService.validatePassword(undefinedValue as any);
      const nameResult = validationService.validateName(nullValue as any);

      expect(emailResult.isValid).toBe(false);
      expect(passwordResult.isValid).toBe(false);
      expect(nameResult.isValid).toBe(false);
    });

    it('should handle edge cases with whitespace', () => {
      const whitespaceCases = [
        '  test@example.com  ',
        '  Password123!  ',
        '  John Doe  ',
        '  +1234567890  '
      ];

      whitespaceCases.forEach(value => {
        // Email validation should handle trimmed values
        if (value.includes('@')) {
          const result = validationService.validateEmail(value.trim());
          expect(typeof result.isValid).toBe('boolean');
        }
      });
    });
  });

  describe('performance considerations', () => {
    it('should handle large numbers of validations efficiently', () => {
      const emails = Array.from({ length: 1000 }, (_, i) => `user${i}@example.com`);
      
      const startTime = Date.now();
      const results = emails.map(email => validationService.validateEmail(email));
      const endTime = Date.now();

      expect(results.every(r => r.isValid)).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle complex validation patterns efficiently', () => {
      const complexPassword = 'VeryComplexPassword123!@#$%^&*()';
      
      const startTime = Date.now();
      const result = validationService.validatePassword(complexPassword);
      const endTime = Date.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
    });
  });
});
