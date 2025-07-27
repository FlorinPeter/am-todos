import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import reportWebVitals from '../reportWebVitals';

// Mock web-vitals module
const mockOnCLS = vi.fn();
const mockOnINP = vi.fn();
const mockOnFCP = vi.fn();
const mockOnLCP = vi.fn();
const mockOnTTFB = vi.fn();

vi.mock('web-vitals', () => ({
  onCLS: mockOnCLS,
  onINP: mockOnINP,
  onFCP: mockOnFCP,
  onLCP: mockOnLCP,
  onTTFB: mockOnTTFB,
}));

describe('reportWebVitals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call all web vitals functions when valid ReportHandler is provided', async () => {
    const mockReportHandler = vi.fn();

    await reportWebVitals(mockReportHandler);

    // Allow time for dynamic import to resolve
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnCLS).toHaveBeenCalledWith(mockReportHandler);
    expect(mockOnINP).toHaveBeenCalledWith(mockReportHandler);
    expect(mockOnFCP).toHaveBeenCalledWith(mockReportHandler);
    expect(mockOnLCP).toHaveBeenCalledWith(mockReportHandler);
    expect(mockOnTTFB).toHaveBeenCalledWith(mockReportHandler);
  });

  it('should not call web vitals functions when no ReportHandler is provided', async () => {
    await reportWebVitals();

    // Allow time for any potential dynamic import
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnCLS).not.toHaveBeenCalled();
    expect(mockOnINP).not.toHaveBeenCalled();
    expect(mockOnFCP).not.toHaveBeenCalled();
    expect(mockOnLCP).not.toHaveBeenCalled();
    expect(mockOnTTFB).not.toHaveBeenCalled();
  });

  it('should not call web vitals functions when null is provided', async () => {
    await reportWebVitals(null as any);

    // Allow time for any potential dynamic import
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnCLS).not.toHaveBeenCalled();
    expect(mockOnINP).not.toHaveBeenCalled();
    expect(mockOnFCP).not.toHaveBeenCalled();
    expect(mockOnLCP).not.toHaveBeenCalled();
    expect(mockOnTTFB).not.toHaveBeenCalled();
  });

  it('should not call web vitals functions when undefined is provided', async () => {
    await reportWebVitals(undefined);

    // Allow time for any potential dynamic import
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnCLS).not.toHaveBeenCalled();
    expect(mockOnINP).not.toHaveBeenCalled();
    expect(mockOnFCP).not.toHaveBeenCalled();
    expect(mockOnLCP).not.toHaveBeenCalled();
    expect(mockOnTTFB).not.toHaveBeenCalled();
  });

  it('should not call web vitals functions when non-function is provided', async () => {
    await reportWebVitals('not a function' as any);

    // Allow time for any potential dynamic import
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnCLS).not.toHaveBeenCalled();
    expect(mockOnINP).not.toHaveBeenCalled();
    expect(mockOnFCP).not.toHaveBeenCalled();
    expect(mockOnLCP).not.toHaveBeenCalled();
    expect(mockOnTTFB).not.toHaveBeenCalled();
  });

  it('should handle dynamic import failure gracefully', async () => {
    const mockReportHandler = vi.fn();
    
    // Mock dynamic import to fail
    const originalImport = global.import;
    global.import = vi.fn().mockRejectedValue(new Error('Import failed'));

    // Should not throw error
    expect(() => reportWebVitals(mockReportHandler)).not.toThrow();

    // Restore original import
    global.import = originalImport;
  });

  it('should work with arrow function ReportHandler', async () => {
    const mockReportHandler = vi.fn();
    const arrowFunction = (metric: any) => mockReportHandler(metric);

    await reportWebVitals(arrowFunction);

    // Allow time for dynamic import to resolve
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnCLS).toHaveBeenCalledWith(arrowFunction);
    expect(mockOnINP).toHaveBeenCalledWith(arrowFunction);
    expect(mockOnFCP).toHaveBeenCalledWith(arrowFunction);
    expect(mockOnLCP).toHaveBeenCalledWith(arrowFunction);
    expect(mockOnTTFB).toHaveBeenCalledWith(arrowFunction);
  });

  it('should work with bound function ReportHandler', async () => {
    const mockObject = {
      handleMetric: vi.fn()
    };
    const boundFunction = mockObject.handleMetric.bind(mockObject);

    await reportWebVitals(boundFunction);

    // Allow time for dynamic import to resolve
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockOnCLS).toHaveBeenCalledWith(boundFunction);
    expect(mockOnINP).toHaveBeenCalledWith(boundFunction);
    expect(mockOnFCP).toHaveBeenCalledWith(boundFunction);
    expect(mockOnLCP).toHaveBeenCalledWith(boundFunction);
    expect(mockOnTTFB).toHaveBeenCalledWith(boundFunction);
  });
});