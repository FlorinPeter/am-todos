import { vi } from 'vitest';
import { validatePriority } from '../markdown';

describe('Priority Validation', () => {
  describe('validatePriority', () => {
    it('should accept valid priority values (1-5)', () => {
      expect(validatePriority(1)).toBe(1);
      expect(validatePriority(2)).toBe(2);
      expect(validatePriority(3)).toBe(3);
      expect(validatePriority(4)).toBe(4);
      expect(validatePriority(5)).toBe(5);
    });

    it('should reject invalid priority values and default to 3', () => {
      expect(validatePriority(0)).toBe(3);
      expect(validatePriority(6)).toBe(3);
      expect(validatePriority(-1)).toBe(3);
      expect(validatePriority(10)).toBe(3);
      expect(validatePriority(999)).toBe(3);
    });

    it('should reject non-integer values and default to 3', () => {
      expect(validatePriority(1.5)).toBe(3);
      expect(validatePriority(3.14)).toBe(3);
      expect(validatePriority(NaN)).toBe(3);
      expect(validatePriority(Infinity)).toBe(3);
    });

    it('should handle string inputs and convert valid ones', () => {
      expect(validatePriority('1' as any)).toBe(1);
      expect(validatePriority('3' as any)).toBe(3);
      expect(validatePriority('5' as any)).toBe(5);
    });

    it('should reject invalid string inputs and default to 3', () => {
      expect(validatePriority('invalid' as any)).toBe(3);
      expect(validatePriority('0' as any)).toBe(3);
      expect(validatePriority('6' as any)).toBe(3);
      expect(validatePriority('abc' as any)).toBe(3);
      expect(validatePriority('' as any)).toBe(3);
    });

    it('should handle null, undefined, and other types', () => {
      expect(validatePriority(null as any)).toBe(3);
      expect(validatePriority(undefined as any)).toBe(3);
      expect(validatePriority({} as any)).toBe(3);
      expect(validatePriority([] as any)).toBe(3);
      expect(validatePriority(true as any)).toBe(3);
      expect(validatePriority(false as any)).toBe(3);
    });

    it('should log warnings for invalid values', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      validatePriority(0);
      validatePriority(6);
      validatePriority('invalid' as any);
      
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });
  });
});