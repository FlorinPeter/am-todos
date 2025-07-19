import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import reportWebVitals from '../reportWebVitals';

// Mock web-vitals module
const mockGetCLS = vi.fn();
const mockGetINP = vi.fn();
const mockGetFCP = vi.fn();
const mockGetLCP = vi.fn();
const mockGetTTFB = vi.fn();

vi.mock('web-vitals', () => ({
  getCLS: mockGetCLS,
  getINP: mockGetINP,
  getFCP: mockGetFCP,
  getLCP: mockGetLCP,
  getTTFB: mockGetTTFB,
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

    expect(mockGetCLS).toHaveBeenCalledWith(mockReportHandler);
    expect(mockGetINP).toHaveBeenCalledWith(mockReportHandler);
    expect(mockGetFCP).toHaveBeenCalledWith(mockReportHandler);
    expect(mockGetLCP).toHaveBeenCalledWith(mockReportHandler);
    expect(mockGetTTFB).toHaveBeenCalledWith(mockReportHandler);
  });

  it('should not call web vitals functions when no ReportHandler is provided', async () => {
    await reportWebVitals();

    // Allow time for any potential dynamic import
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockGetCLS).not.toHaveBeenCalled();
    expect(mockGetINP).not.toHaveBeenCalled();
    expect(mockGetFCP).not.toHaveBeenCalled();
    expect(mockGetLCP).not.toHaveBeenCalled();
    expect(mockGetTTFB).not.toHaveBeenCalled();
  });

  it('should not call web vitals functions when null is provided', async () => {
    await reportWebVitals(null as any);

    // Allow time for any potential dynamic import
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockGetCLS).not.toHaveBeenCalled();
    expect(mockGetINP).not.toHaveBeenCalled();
    expect(mockGetFCP).not.toHaveBeenCalled();
    expect(mockGetLCP).not.toHaveBeenCalled();
    expect(mockGetTTFB).not.toHaveBeenCalled();
  });

  it('should not call web vitals functions when undefined is provided', async () => {
    await reportWebVitals(undefined);

    // Allow time for any potential dynamic import
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockGetCLS).not.toHaveBeenCalled();
    expect(mockGetINP).not.toHaveBeenCalled();
    expect(mockGetFCP).not.toHaveBeenCalled();
    expect(mockGetLCP).not.toHaveBeenCalled();
    expect(mockGetTTFB).not.toHaveBeenCalled();
  });

  it('should not call web vitals functions when non-function is provided', async () => {
    await reportWebVitals('not a function' as any);

    // Allow time for any potential dynamic import
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockGetCLS).not.toHaveBeenCalled();
    expect(mockGetINP).not.toHaveBeenCalled();
    expect(mockGetFCP).not.toHaveBeenCalled();
    expect(mockGetLCP).not.toHaveBeenCalled();
    expect(mockGetTTFB).not.toHaveBeenCalled();
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

    expect(mockGetCLS).toHaveBeenCalledWith(arrowFunction);
    expect(mockGetINP).toHaveBeenCalledWith(arrowFunction);
    expect(mockGetFCP).toHaveBeenCalledWith(arrowFunction);
    expect(mockGetLCP).toHaveBeenCalledWith(arrowFunction);
    expect(mockGetTTFB).toHaveBeenCalledWith(arrowFunction);
  });

  it('should work with bound function ReportHandler', async () => {
    const mockObject = {
      handleMetric: vi.fn()
    };
    const boundFunction = mockObject.handleMetric.bind(mockObject);

    await reportWebVitals(boundFunction);

    // Allow time for dynamic import to resolve
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockGetCLS).toHaveBeenCalledWith(boundFunction);
    expect(mockGetINP).toHaveBeenCalledWith(boundFunction);
    expect(mockGetFCP).toHaveBeenCalledWith(boundFunction);
    expect(mockGetLCP).toHaveBeenCalledWith(boundFunction);
    expect(mockGetTTFB).toHaveBeenCalledWith(boundFunction);
  });
});