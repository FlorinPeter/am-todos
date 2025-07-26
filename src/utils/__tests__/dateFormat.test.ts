import { describe, test, expect } from 'vitest';
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

  // Edge case tests for improved coverage
  test('handles leap year correctly', () => {
    const result = formatDate('2024-02-29T12:00:00.000Z');
    expect(result).toBe('29.02.2024');
  });

  test('handles non-leap year February 28th', () => {
    const result = formatDate('2023-02-28T12:00:00.000Z');
    expect(result).toBe('28.02.2023');
  });

  test('handles year boundaries correctly', () => {
    const result = formatDate('2023-12-31T12:00:00.000Z');
    expect(result).toBe('31.12.2023');
  });

  test('handles month boundaries correctly', () => {
    const result = formatDate('2024-01-31T12:00:00.000Z');
    expect(result).toBe('31.01.2024');
  });

  test('handles single digit day and month padding', () => {
    const result = formatDate('2024-01-05T12:00:00.000Z');
    expect(result).toBe('05.01.2024');
  });

  test('handles minimum valid year', () => {
    const result = formatDate('1970-01-01T00:00:00.000Z');
    expect(result).toBe('01.01.1970');
  });

  test('handles far future date', () => {
    const result = formatDate('2099-12-31T12:00:00.000Z');
    expect(result).toBe('31.12.2099');
  });

  test('handles different timezone offset formats', () => {
    const result = formatDate('2024-06-15T14:30:00+05:30');
    expect(result).toBe('15.06.2024');
  });

  test('handles milliseconds in timestamp', () => {
    const result = formatDate('2024-07-20T12:34:56.789Z');
    expect(result).toBe('20.07.2024');
  });

  test('handles date without time component', () => {
    const result = formatDate('2024-08-10');
    expect(result).toBe('10.08.2024');
  });

  test('handles numeric timestamp string', () => {
    // String version of timestamp should be treated as invalid
    const result = formatDate('1690891200000');
    expect(result).toBe('NaN.NaN.NaN');
  });

  test('handles whitespace in date string', () => {
    const result = formatDate('  2024-09-25  ');
    expect(result).toBe('25.09.2024');
  });

  test('handles malformed ISO string', () => {
    const result = formatDate('2024-13-45T25:70:90.000Z');
    expect(result).toBe('NaN.NaN.NaN');
  });

  test('handles number input (Date constructor edge case)', () => {
    const result = formatDate(1640995200000 as any); // Jan 1, 2022
    expect(result).toBe('01.01.2022');
  });

  test('handles object input gracefully', () => {
    const result = formatDate({} as any);
    expect(result).toBe('NaN.NaN.NaN');
  });
});