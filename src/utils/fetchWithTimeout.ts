/**
 * Fetch utility with timeout support to prevent hanging requests
 * Addresses security vulnerability: Missing API Response Time Limits
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number; // timeout in milliseconds
}

/**
 * Fetch wrapper that adds timeout support and validates response content-type
 * @param url - URL to fetch
 * @param options - Fetch options with optional timeout
 * @returns Promise<Response>
 */
export const fetchWithTimeout = async (
  url: string, 
  options: FetchWithTimeoutOptions = {}
): Promise<Response> => {
  const { timeout = 30000, ...fetchOptions } = options; // Default 30 second timeout
  
  // Create an AbortController for timeout handling
  const controller = new AbortController();
  
  // Set up timeout
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
};

/**
 * Fetch with timeout and JSON response parsing with content-type validation
 * @param url - URL to fetch
 * @param options - Fetch options with optional timeout
 * @returns Promise<any> - Parsed JSON response
 */
export const fetchJsonWithTimeout = async (
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<any> => {
  const response = await fetchWithTimeout(url, options);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  // Validate content-type before parsing as JSON (only if headers exist)
  if (response.headers && typeof response.headers.get === 'function') {
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn(`Expected JSON response but got content-type: ${contentType}`);
      // Still try to parse as JSON for backward compatibility
    }
  }
  
  return response.json();
};

/**
 * Default timeout values for different types of operations
 */
export const TIMEOUT_VALUES = {
  FAST: 10000,    // 10 seconds for fast operations
  NORMAL: 30000,  // 30 seconds for normal operations
  SLOW: 60000,    // 60 seconds for slow operations like file uploads
  AI: 120000      // 2 minutes for AI API calls which can be slow
} as const;