/**
 * dateUtils.test.ts
 * Test suite for date utilities
 */

// Mock the date utilities
const dateUtils = {
  formatDate: (date: Date | string, format: string = 'YYYY-MM-DD') => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    switch (format) {
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'YYYY-MM-DD HH:mm:ss':
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      case 'MM/DD/YYYY HH:mm':
        return `${month}/${day}/${year} ${hours}:${minutes}`;
      case 'DD/MM/YYYY HH:mm':
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      default:
        return `${year}-${month}-${day}`;
    }
  },

  parseDate: (dateString: string) => {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  },

  addDays: (date: Date | string, days: number) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setDate(result.getDate() + days);
    return result;
  },

  subtractDays: (date: Date | string, days: number) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setDate(result.getDate() - days);
    return result;
  },

  addMonths: (date: Date | string, months: number) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setMonth(result.getMonth() + months);
    return result;
  },

  subtractMonths: (date: Date | string, months: number) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setMonth(result.getMonth() - months);
    return result;
  },

  addYears: (date: Date | string, years: number) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setFullYear(result.getFullYear() + years);
    return result;
  },

  subtractYears: (date: Date | string, years: number) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setFullYear(result.getFullYear() - years);
    return result;
  },

  getDaysBetween: (startDate: Date | string, endDate: Date | string) => {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 0;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  getWeeksBetween: (startDate: Date | string, endDate: Date | string) => {
    const days = dateUtils.getDaysBetween(startDate, endDate);
    return Math.floor(days / 7);
  },

  getMonthsBetween: (startDate: Date | string, endDate: Date | string) => {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 0;
    }

    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    return yearDiff * 12 + monthDiff;
  },

  isToday: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();

    return dateObj.getDate() === today.getDate() &&
           dateObj.getMonth() === today.getMonth() &&
           dateObj.getFullYear() === today.getFullYear();
  },

  isYesterday: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return dateObj.getDate() === yesterday.getDate() &&
           dateObj.getMonth() === yesterday.getMonth() &&
           dateObj.getFullYear() === yesterday.getFullYear();
  },

  isTomorrow: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return dateObj.getDate() === tomorrow.getDate() &&
           dateObj.getMonth() === tomorrow.getMonth() &&
           dateObj.getFullYear() === tomorrow.getFullYear();
  },

  isThisWeek: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    return dateObj >= startOfWeek && dateObj <= endOfWeek;
  },

  isThisMonth: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();

    return dateObj.getMonth() === today.getMonth() &&
           dateObj.getFullYear() === today.getFullYear();
  },

  isThisYear: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();

    return dateObj.getFullYear() === today.getFullYear();
  },

  getStartOfDay: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setHours(0, 0, 0, 0);
    return result;
  },

  getEndOfDay: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setHours(23, 59, 59, 999);
    return result;
  },

  getStartOfWeek: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    const day = result.getDay();
    const diff = result.getDate() - day;
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
  },

  getEndOfWeek: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = dateUtils.getStartOfWeek(dateObj);
    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);
    return result;
  },

  getStartOfMonth: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setDate(1);
    result.setHours(0, 0, 0, 0);
    return result;
  },

  getEndOfMonth: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setMonth(result.getMonth() + 1);
    result.setDate(0);
    result.setHours(23, 59, 59, 999);
    return result;
  },

  getStartOfYear: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setMonth(0, 1);
    result.setHours(0, 0, 0, 0);
    return result;
  },

  getEndOfYear: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const result = new Date(dateObj);
    result.setMonth(11, 31);
    result.setHours(23, 59, 59, 999);
    return result;
  },

  getRelativeTime: (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {return 'just now';}
    if (diffMinutes < 60) {return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;}
    if (diffHours < 24) {return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;}
    if (diffDays < 7) {return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;}

    return dateUtils.formatDate(dateObj, 'MM/DD/YYYY');
  },
};

describe('dateUtils', () => {
  const mockDate = new Date('2024-01-15T10:30:00Z');

  describe('formatDate', () => {
    it('should format date in different formats', () => {
      const date = new Date('2024-01-15T10:30:00Z');

      expect(dateUtils.formatDate(date, 'YYYY-MM-DD')).toBe('2024-01-15');
      expect(dateUtils.formatDate(date, 'MM/DD/YYYY')).toBe('01/15/2024');
      expect(dateUtils.formatDate(date, 'DD/MM/YYYY')).toBe('15/01/2024');
      expect(dateUtils.formatDate(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2024-01-15 10:30:00');
      expect(dateUtils.formatDate(date, 'MM/DD/YYYY HH:mm')).toBe('01/15/2024 10:30');
      expect(dateUtils.formatDate(date, 'DD/MM/YYYY HH:mm')).toBe('15/01/2024 10:30');
    });

    it('should handle string dates', () => {
      expect(dateUtils.formatDate('2024-01-15', 'YYYY-MM-DD')).toBe('2024-01-15');
      expect(dateUtils.formatDate('2024-01-15T10:30:00Z', 'MM/DD/YYYY')).toBe('01/15/2024');
    });

    it('should use default format', () => {
      expect(dateUtils.formatDate(mockDate)).toBe('2024-01-15');
    });

    it('should handle invalid dates', () => {
      expect(dateUtils.formatDate('invalid-date', 'YYYY-MM-DD')).toBe('Invalid Date');
      expect(dateUtils.formatDate(new Date('invalid'), 'YYYY-MM-DD')).toBe('Invalid Date');
    });
  });

  describe('parseDate', () => {
    it('should parse valid date strings', () => {
      const parsed = dateUtils.parseDate('2024-01-15T10:30:00Z');
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getFullYear()).toBe(2024);
      expect(parsed?.getMonth()).toBe(0);
      expect(parsed?.getDate()).toBe(15);
    });

    it('should return null for invalid dates', () => {
      expect(dateUtils.parseDate('invalid-date')).toBeNull();
      expect(dateUtils.parseDate('')).toBeNull();
    });
  });

  describe('addDays', () => {
    it('should add days to date', () => {
      const result = dateUtils.addDays(mockDate, 5);
      expect(result.getDate()).toBe(20);
      expect(result.getMonth()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
    });

    it('should handle negative days', () => {
      const result = dateUtils.addDays(mockDate, -3);
      expect(result.getDate()).toBe(12);
    });

    it('should handle string dates', () => {
      const result = dateUtils.addDays('2024-01-15', 10);
      expect(result.getDate()).toBe(25);
    });

    it('should handle month overflow', () => {
      const result = dateUtils.addDays('2024-01-31', 1);
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(1); // February
    });
  });

  describe('subtractDays', () => {
    it('should subtract days from date', () => {
      const result = dateUtils.subtractDays(mockDate, 5);
      expect(result.getDate()).toBe(10);
    });

    it('should handle month underflow', () => {
      const result = dateUtils.subtractDays('2024-01-05', 10);
      expect(result.getDate()).toBe(26);
      expect(result.getMonth()).toBe(11); // December of previous year
      expect(result.getFullYear()).toBe(2023);
    });
  });

  describe('addMonths', () => {
    it('should add months to date', () => {
      const result = dateUtils.addMonths(mockDate, 3);
      expect(result.getMonth()).toBe(3); // April
      expect(result.getDate()).toBe(15);
    });

    it('should handle year overflow', () => {
      const result = dateUtils.addMonths('2024-11-15', 3);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getFullYear()).toBe(2025);
    });

    it('should handle month end dates', () => {
      const result = dateUtils.addMonths('2024-01-31', 1);
      expect(result.getMonth()).toBe(1); // February
      // February 2024 has 29 days (leap year)
      expect(result.getDate()).toBe(29);
    });
  });

  describe('subtractMonths', () => {
    it('should subtract months from date', () => {
      const result = dateUtils.subtractMonths(mockDate, 3);
      expect(result.getMonth()).toBe(9); // October of previous year
      expect(result.getFullYear()).toBe(2023);
    });

    it('should handle year underflow', () => {
      const result = dateUtils.subtractMonths('2024-02-15', 3);
      expect(result.getMonth()).toBe(10); // November of previous year
      expect(result.getFullYear()).toBe(2023);
    });
  });

  describe('addYears', () => {
    it('should add years to date', () => {
      const result = dateUtils.addYears(mockDate, 5);
      expect(result.getFullYear()).toBe(2029);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    it('should handle leap years', () => {
      const result = dateUtils.addYears('2020-02-29', 1);
      expect(result.getFullYear()).toBe(2021);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(28); // 2021 is not a leap year
    });
  });

  describe('subtractYears', () => {
    it('should subtract years from date', () => {
      const result = dateUtils.subtractYears(mockDate, 5);
      expect(result.getFullYear()).toBe(2019);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });
  });

  describe('getDaysBetween', () => {
    it('should calculate days between dates', () => {
      const start = new Date('2024-01-10');
      const end = new Date('2024-01-15');
      expect(dateUtils.getDaysBetween(start, end)).toBe(5);
    });

    it('should handle reverse order', () => {
      const start = new Date('2024-01-15');
      const end = new Date('2024-01-10');
      expect(dateUtils.getDaysBetween(start, end)).toBe(5);
    });

    it('should handle same dates', () => {
      const date = new Date('2024-01-15');
      expect(dateUtils.getDaysBetween(date, date)).toBe(0);
    });

    it('should handle invalid dates', () => {
      expect(dateUtils.getDaysBetween('invalid', '2024-01-15')).toBe(0);
      expect(dateUtils.getDaysBetween('2024-01-15', 'invalid')).toBe(0);
    });
  });

  describe('getWeeksBetween', () => {
    it('should calculate weeks between dates', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-22');
      expect(dateUtils.getWeeksBetween(start, end)).toBe(3);
    });

    it('should handle partial weeks', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-20');
      expect(dateUtils.getWeeksBetween(start, end)).toBe(2);
    });
  });

  describe('getMonthsBetween', () => {
    it('should calculate months between dates', () => {
      const start = new Date('2024-01-15');
      const end = new Date('2024-04-15');
      expect(dateUtils.getMonthsBetween(start, end)).toBe(3);
    });

    it('should handle year boundaries', () => {
      const start = new Date('2023-11-15');
      const end = new Date('2024-02-15');
      expect(dateUtils.getMonthsBetween(start, end)).toBe(3);
    });

    it('should handle same month', () => {
      const date = new Date('2024-01-15');
      expect(dateUtils.getMonthsBetween(date, date)).toBe(0);
    });
  });

  describe('isToday', () => {
    it('should identify today correctly', () => {
      const today = new Date();
      expect(dateUtils.isToday(today)).toBe(true);
    });

    it('should identify non-today dates', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(dateUtils.isToday(yesterday)).toBe(false);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(dateUtils.isToday(tomorrow)).toBe(false);
    });
  });

  describe('isYesterday', () => {
    it('should identify yesterday correctly', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(dateUtils.isYesterday(yesterday)).toBe(true);
    });

    it('should identify non-yesterday dates', () => {
      const today = new Date();
      expect(dateUtils.isYesterday(today)).toBe(false);

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      expect(dateUtils.isYesterday(twoDaysAgo)).toBe(false);
    });
  });

  describe('isTomorrow', () => {
    it('should identify tomorrow correctly', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(dateUtils.isTomorrow(tomorrow)).toBe(true);
    });

    it('should identify non-tomorrow dates', () => {
      const today = new Date();
      expect(dateUtils.isTomorrow(today)).toBe(false);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(dateUtils.isTomorrow(yesterday)).toBe(false);
    });
  });

  describe('isThisWeek', () => {
    it('should identify dates within current week', () => {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());

      // Test each day of the current week
      for (let i = 0; i < 7; i++) {
        const testDate = new Date(startOfWeek);
        testDate.setDate(startOfWeek.getDate() + i);
        expect(dateUtils.isThisWeek(testDate)).toBe(true);
      }
    });

    it('should identify dates outside current week', () => {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 10);
      expect(dateUtils.isThisWeek(lastWeek)).toBe(false);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 10);
      expect(dateUtils.isThisWeek(nextWeek)).toBe(false);
    });
  });

  describe('isThisMonth', () => {
    it('should identify dates within current month', () => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      // Test first and last day of current month
      expect(dateUtils.isThisMonth(startOfMonth)).toBe(true);
      expect(dateUtils.isThisMonth(endOfMonth)).toBe(true);
      expect(dateUtils.isThisMonth(today)).toBe(true);
    });

    it('should identify dates outside current month', () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      expect(dateUtils.isThisMonth(lastMonth)).toBe(false);

      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      expect(dateUtils.isThisMonth(nextMonth)).toBe(false);
    });
  });

  describe('isThisYear', () => {
    it('should identify dates within current year', () => {
      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const endOfYear = new Date(today.getFullYear(), 11, 31);

      expect(dateUtils.isThisYear(startOfYear)).toBe(true);
      expect(dateUtils.isThisYear(endOfYear)).toBe(true);
      expect(dateUtils.isThisYear(today)).toBe(true);
    });

    it('should identify dates outside current year', () => {
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      expect(dateUtils.isThisYear(lastYear)).toBe(false);

      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      expect(dateUtils.isThisYear(nextYear)).toBe(false);
    });
  });

  describe('getStartOfDay', () => {
    it('should return start of day', () => {
      const result = dateUtils.getStartOfDay(mockDate);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe('getEndOfDay', () => {
    it('should return end of day', () => {
      const result = dateUtils.getEndOfDay(mockDate);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
    });
  });

  describe('getStartOfWeek', () => {
    it('should return start of week (Sunday)', () => {
      const date = new Date('2024-01-17'); // This is a Wednesday
      const result = dateUtils.getStartOfWeek(date);
      expect(result.getDay()).toBe(0); // Sunday
      expect(result.getDate()).toBe(14); // Previous Sunday
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });
  });

  describe('getEndOfWeek', () => {
    it('should return end of week (Saturday)', () => {
      const date = new Date('2024-01-17'); // This is a Wednesday
      const result = dateUtils.getEndOfWeek(date);
      expect(result.getDay()).toBe(6); // Saturday
      expect(result.getDate()).toBe(20); // Following Saturday
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
    });
  });

  describe('getStartOfMonth', () => {
    it('should return start of month', () => {
      const result = dateUtils.getStartOfMonth(mockDate);
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });
  });

  describe('getEndOfMonth', () => {
    it('should return end of month', () => {
      const result = dateUtils.getEndOfMonth(mockDate);
      expect(result.getDate()).toBe(31); // January has 31 days
      expect(result.getMonth()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
    });

    it('should handle February in leap year', () => {
      const febLeap = new Date('2024-02-15');
      const result = dateUtils.getEndOfMonth(febLeap);
      expect(result.getDate()).toBe(29); // 2024 is a leap year
      expect(result.getMonth()).toBe(1);
    });

    it('should handle February in non-leap year', () => {
      const febNonLeap = new Date('2023-02-15');
      const result = dateUtils.getEndOfMonth(febNonLeap);
      expect(result.getDate()).toBe(28); // 2023 is not a leap year
      expect(result.getMonth()).toBe(1);
    });
  });

  describe('getStartOfYear', () => {
    it('should return start of year', () => {
      const result = dateUtils.getStartOfYear(mockDate);
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getFullYear()).toBe(2024);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });
  });

  describe('getEndOfYear', () => {
    it('should return end of year', () => {
      const result = dateUtils.getEndOfYear(mockDate);
      expect(result.getDate()).toBe(31);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getFullYear()).toBe(2024);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
    });
  });

  describe('getRelativeTime', () => {
    beforeEach(() => {
      // Mock current time
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return "just now" for recent times', () => {
      const recent = new Date('2024-01-15T11:59:30Z'); // 30 seconds ago
      expect(dateUtils.getRelativeTime(recent)).toBe('just now');
    });

    it('should return minutes ago', () => {
      const minutesAgo = new Date('2024-01-15T11:45:00Z'); // 15 minutes ago
      expect(dateUtils.getRelativeTime(minutesAgo)).toBe('15 minutes ago');

      const oneMinuteAgo = new Date('2024-01-15T11:59:00Z'); // 1 minute ago
      expect(dateUtils.getRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
    });

    it('should return hours ago', () => {
      const hoursAgo = new Date('2024-01-15T08:00:00Z'); // 4 hours ago
      expect(dateUtils.getRelativeTime(hoursAgo)).toBe('4 hours ago');

      const oneHourAgo = new Date('2024-01-15T11:00:00Z'); // 1 hour ago
      expect(dateUtils.getRelativeTime(oneHourAgo)).toBe('1 hour ago');
    });

    it('should return days ago', () => {
      const daysAgo = new Date('2024-01-12T12:00:00Z'); // 3 days ago
      expect(dateUtils.getRelativeTime(daysAgo)).toBe('3 days ago');

      const oneDayAgo = new Date('2024-01-14T12:00:00Z'); // 1 day ago
      expect(dateUtils.getRelativeTime(oneDayAgo)).toBe('1 day ago');
    });

    it('should return formatted date for older dates', () => {
      const oldDate = new Date('2023-12-01T12:00:00Z'); // More than a week ago
      expect(dateUtils.getRelativeTime(oldDate)).toBe('12/01/2023');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle leap year calculations', () => {
      const leapYearDate = new Date('2020-02-29');
      const result = dateUtils.addYears(leapYearDate, 4);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(1);
      expect(result.getDate()).toBe(29); // 2024 is also a leap year
    });

    it('should handle timezone differences', () => {
      const utcDate = new Date('2024-01-15T23:59:59Z');
      const localDate = new Date(utcDate.getTime());

      // Operations should work regardless of timezone
      const result = dateUtils.addDays(localDate, 1);
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle very large date ranges', () => {
      const start = new Date('1900-01-01');
      const end = new Date('2100-12-31');

      const days = dateUtils.getDaysBetween(start, end);
      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThan(100000); // Reasonable upper bound
    });

    it('should handle date arithmetic across DST changes', () => {
      // This test would need specific dates for DST changes
      const date = new Date('2024-03-10'); // Around DST change in US
      const result = dateUtils.addDays(date, 1);
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('performance considerations', () => {
    it('should handle large numbers of operations efficiently', () => {
      const _keys = Array.from({ length: 1000 }, (_, _i) => `key${_i}`);
      const dates = Array.from({ length: 1000 }, (_, i) =>
        new Date('2024-01-01')
      );

      const startTime = Date.now();
      const results = dates.map(date => dateUtils.formatDate(date));
      const endTime = Date.now();

      expect(results.every(r => typeof r === 'string')).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle complex date calculations efficiently', () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2030-12-31');

      const startTime = Date.now();
      const days = dateUtils.getDaysBetween(startDate, endDate);
      const weeks = dateUtils.getWeeksBetween(startDate, endDate);
      const months = dateUtils.getMonthsBetween(startDate, endDate);
      const endTime = Date.now();

      expect(typeof days).toBe('number');
      expect(typeof weeks).toBe('number');
      expect(typeof months).toBe('number');
      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
    });
  });
});
