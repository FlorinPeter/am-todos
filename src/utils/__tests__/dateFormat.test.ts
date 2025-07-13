import { vi, describe, test, expect } from 'vitest';
import { formatDate } from '../dateFormat';

describe('DateFormat', () => {
  test('formats ISO date string correctly', () => {
    const result = formatDate('2024-01-15T10:30:00.000Z');
    expect(result).toBe('15.01.2024');
  });

  test('formats simple date string correctly', () => {
    const result = formatDate('2024-12-25');
    expect(result).toBe('25.12.2024');
  });

  test('handles invalid date gracefully', () => {
    const result = formatDate('invalid-date');
    expect(result).toBe('NaN.NaN.NaN');
  });

  test('handles null input', () => {
    const result = formatDate(null as any);
    expect(result).toBe('01.01.1970');
  });

  test('handles undefined input', () => {
    const result = formatDate(undefined as any);
    expect(result).toBe('NaN.NaN.NaN');
  });

  test('handles empty string', () => {
    const result = formatDate('');
    expect(result).toBe('NaN.NaN.NaN');
  });

  test('formats recent date correctly', () => {
    const result = formatDate('2024-03-01T00:00:00.000Z');
    expect(result).toBe('01.03.2024');
  });
});