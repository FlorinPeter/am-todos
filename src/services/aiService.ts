import { loadSettings } from '../utils/localStorage';
import type { GeneralSettings } from '../utils/localStorage';
import { AIResponse, AIResponseWithFallback, CommitMessageResponseWithFallback } from '../types';
import logger from '../utils/logger';
import { fetchJsonWithTimeout, TIMEOUT_VALUES } from '../utils/fetchWithTimeout';

// Single AI API endpoint for all providers
const getApiUrl = () => {
  return '/api/ai';
};


const getAISettings = () => {
  const settings: GeneralSettings | null = loadSettings();
  if (!settings) {
    throw new Error('No settings configured. Please configure your settings in the application.');
  }

  const provider = settings.aiProvider || 'gemini';
  let apiKey: string | null = null;
  
  if (provider === 'gemini') {
    if (!settings.geminiApiKey) {
      throw new Error('Gemini API key not configured. Please add your API key in the application settings.');
    }
    apiKey = settings.geminiApiKey;
  } else if (provider === 'openrouter') {
    if (!settings.openRouterApiKey) {
      throw new Error('OpenRouter API key not configured. Please add your API key in the application settings.');
    }
    apiKey = settings.openRouterApiKey;
  } else if (provider === 'local-proxy') {
    // Validate local proxy is configured and connected
    if (!settings.localProxy) {
      throw new Error('Local proxy not configured. Please set up your local proxy in the Local AI Proxy Setup section.');
    }
    if (!settings.localProxy.proxyUuid || !settings.localProxy.proxyLocalToken) {
      throw new Error('Local proxy credentials not configured. Please enter your proxy UUID and local token in Settings.');
    }
    if (settings.localProxy.connectionStatus !== 'connected') {
      throw new Error('Local proxy is not connected. Please ensure your proxy is running and test the connection.');
    }
    // No API key needed for local proxy
    apiKey = null;
  } else {
    throw new Error('Invalid AI provider configured. Please select a valid provider in the application settings.');
  }

  return {
    provider,
    apiKey,
    model: settings.aiModel || (
      provider === 'gemini' ? 'gemini-2.5-flash' : 
      provider === 'openrouter' ? 'anthropic/claude-3.5-sonnet' :
      'local' // For local-proxy, use 'local' as model identifier
    )
  };
};

export const generateInitialPlan = async (
  goalData: string | { title: string; description?: string; template?: string },
  markdownContent?: string
) => {
  try {
    // Handle backward compatibility - convert string to object format
    const payload = typeof goalData === 'string' 
      ? { goal: goalData }
      : { 
          title: goalData.title,
          description: goalData.description,
          template: goalData.template || 'general'
        };

    const aiSettings = getAISettings();
    const settings = loadSettings();
    const localProxy = settings?.localProxy;
    
    const data = await fetchJsonWithTimeout(getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateInitialPlan',
        payload,
        provider: aiSettings.provider,
        apiKey: aiSettings.apiKey,
        model: aiSettings.model,
        // Include proxy credentials for local-proxy provider
        proxyUuid: localProxy?.proxyUuid,
        proxyLocalToken: localProxy?.proxyLocalToken
      }),
      timeout: TIMEOUT_VALUES.AI,
    });

    // Handle proxy responses (both structured and non-structured)
    if (data.processedLocally) {
      if (data.text) {
        // Structured proxy response - same format as regular providers
        try {
          const jsonResponse = JSON.parse(data.text);
          if (jsonResponse.content && typeof jsonResponse.content === 'string') {
            logger.log('AI Service: Successfully parsed structured JSON response from proxy');
            return jsonResponse.content;
          }
          if (jsonResponse.title && jsonResponse.content) {
            logger.log('AI Service: Successfully parsed structured JSON response with title from proxy');
            return jsonResponse.content;
          }
        } catch (parseError) {
          logger.log('AI Service: JSON parsing failed for proxy response, using plain text fallback');
          return data.text;
        }
      } else if (data.content && typeof data.content === 'string') {
        // Non-structured proxy response (backward compatibility)
        logger.log('AI Service: Successfully received non-structured response from local proxy');
        return data.content;
      }
    }

    // Handle regular provider responses
    if (data.text) {
      // Try to parse JSON response first (new structured format)
      try {
        const jsonResponse = JSON.parse(data.text);
        if (jsonResponse.content && typeof jsonResponse.content === 'string') {
          logger.log('AI Service: Successfully parsed JSON response for generateInitialPlan');
          return jsonResponse.content;
        }
        if (jsonResponse.title && jsonResponse.content) {
          logger.log('AI Service: Successfully parsed JSON response with title and content');
          return jsonResponse.content;
        }
      } catch (parseError) {
        logger.log('AI Service: JSON parsing failed, using plain text response as fallback');
      }

      return data.text;
    }

    logger.error('AI Service: Unknown response format received:', data);
    throw new Error('Invalid AI response format received');
  } catch (error) {
    logger.error('AI Service: Network or fetch error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to AI service. Please check if the backend server is running.');
    }
    throw error;
  }
};

/**
 * Parse AI response for commit message with multiple fallback strategies
 */
const parseCommitResponse = (rawResponse: string, provider: string, model: string): CommitMessageResponseWithFallback => {
  const responsePreview = rawResponse ? rawResponse.substring(0, 200) + (rawResponse.length > 200 ? '...' : '') : 'undefined';
  logger.log('AI Service: Raw response from', provider, model, ':', responsePreview);
  
  // Handle null/undefined response
  if (!rawResponse) {
    logger.error('AI Service: Received null/undefined response, using fallback');
    return {
      message: 'feat: update changes',
      description: 'Generated fallback commit message due to empty AI response'
    };
  }
  
  // 1. Try direct JSON parsing
  try {
    const json = JSON.parse(rawResponse);
    if (json.message && json.description) {
      logger.log('AI Service: Successfully parsed direct JSON response');
      return json;
    }
    if (json.message) {
      logger.log('AI Service: Parsed JSON with message only, generating description');
      return { 
        message: json.message, 
        description: 'Generated conventional commit message' 
      };
    }
  } catch (jsonError) {
    // Continue to next parsing strategy
  }
  
  // 2. Try extracting JSON from markdown code blocks
  const jsonMatch = rawResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[1]);
      if (json.message && json.description) {
        logger.log('AI Service: Successfully extracted JSON from markdown code block');
        return json;
      }
      if (json.message) {
        logger.log('AI Service: Extracted JSON from markdown with message only');
        return {
          message: json.message,
          description: 'Extracted commit message from AI response'
        };
      }
    } catch (parseError) {
      logger.log('AI Service: Failed to parse JSON from markdown code block');
    }
  }
  
  // 3. Extract commit message from markdown code blocks (any language)
  const commitMatch = rawResponse.match(/```[^`]*?\n?\s*([^\n]*(?:feat|fix|docs|chore|style|refactor|perf|test|build|ci)[^\n]*)\s*```/i);
  if (commitMatch) {
    const message = commitMatch[1].trim();
    logger.log('AI Service: Extracted commit message from markdown code block:', message);
    return {
      message: message,
      description: 'Extracted commit message from markdown response'
    };
  }
  
  // 4. Look for conventional commit patterns in text
  const conventionalMatch = rawResponse.match(/((?:feat|fix|docs|chore|style|refactor|perf|test|build|ci)(?:\([^)]*\))?\s*:\s*[^\n]+)/i);
  if (conventionalMatch) {
    const message = conventionalMatch[1].trim();
    logger.log('AI Service: Found conventional commit pattern in text:', message);
    return {
      message: message,
      description: 'Extracted commit message from plain text response'
    };
  }
  
  // 5. Look for any commit-like pattern (starts with common types)
  const generalCommitMatch = rawResponse.match(/^[^`]*?((?:feat|fix|docs|chore|style|refactor|perf|test|build|ci)[^`\n]*)/im);
  if (generalCommitMatch) {
    const message = generalCommitMatch[1].trim();
    logger.log('AI Service: Found general commit pattern:', message);
    return {
      message: message,
      description: 'Extracted commit message pattern from AI response'
    };
  }
  
  // 6. Final fallback - clean up the raw response and use as message
  const cleanedResponse = rawResponse
    .replace(/```[^`]*```/g, '') // Remove code blocks
    .replace(/Sure,?\s*here'?s?\s*[^:]*:\s*/i, '') // Remove common AI prefixes
    .replace(/Here'?s?\s*[^:]*:\s*/i, '') // Remove "Here's..." prefixes
    .replace(/^\s*[-*]\s*/, '') // Remove leading bullet points
    .trim();
    
  const finalMessage = cleanedResponse || 'fix: Update task';
  logger.log('AI Service: Using fallback parsing, cleaned message:', finalMessage);
  
  return {
    message: finalMessage,
    description: 'Used cleaned AI response as commit message'
  };
};

export const generateCommitMessage = async (
  changeDescription: string, 
  markdownContent?: string
): Promise<CommitMessageResponseWithFallback> => {
  try {
    const payload = { 
      changeDescription
    };

    const aiSettings = getAISettings();
    const settings = loadSettings();
    const localProxy = settings?.localProxy;
    
    const data = await fetchJsonWithTimeout(getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateCommitMessage',
        payload,
        provider: aiSettings.provider,
        apiKey: aiSettings.apiKey,
        model: aiSettings.model,
        // Include proxy credentials for local-proxy provider
        proxyUuid: localProxy?.proxyUuid,
        proxyLocalToken: localProxy?.proxyLocalToken
      }),
      timeout: TIMEOUT_VALUES.AI,
    });

    // Handle proxy responses (both structured and non-structured)
    const provider = data.processedLocally ? 'local' : aiSettings.provider;
    const model = data.processedLocally ? 'local' : (aiSettings.model || 'default');

    if (data.processedLocally) {
      if (data.text) {
        // Structured proxy response - same format as regular providers
        logger.log('AI Service: Successfully received structured response from local proxy for commit message');
        return parseCommitResponse(data.text, provider, model);
      } else if (data.content && typeof data.content === 'string') {
        // Non-structured proxy response (backward compatibility)
        logger.log('AI Service: Successfully received non-structured response from local proxy for commit message');
        return parseCommitResponse(data.content, provider, model);
      }
    }

    // Handle regular provider responses
    if (data.text) {
      return parseCommitResponse(data.text, provider, model);
    }

    logger.error('AI Service: Unknown commit message response format received:', data);
    throw new Error('Invalid AI response format received for commit message');
  } catch (error) {
    logger.error('AI Service: Commit message generation error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to AI service for commit message generation.');
    }
    throw error;
  }
};

export const processChatMessage = async (
  message: string, 
  currentContent: string, 
  chatHistory: Array<{ role: string; content: string }>
): Promise<AIResponseWithFallback> => {
  try {
    const payload = { 
      message, 
      currentContent, 
      chatHistory 
    };

    const aiSettings = getAISettings();
    const settings = loadSettings();
    const localProxy = settings?.localProxy;
    
    const data = await fetchJsonWithTimeout(getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'processChatMessage',
        payload,
        provider: aiSettings.provider,
        apiKey: aiSettings.apiKey,
        model: aiSettings.model,
        // Include proxy credentials for local-proxy provider
        proxyUuid: localProxy?.proxyUuid,
        proxyLocalToken: localProxy?.proxyLocalToken
      }),
      timeout: TIMEOUT_VALUES.AI,
    });
    
    // Handle proxy responses (both structured and non-structured)
    if (data.processedLocally) {
      if (data.text) {
        // Structured proxy response - same format as regular providers
        try {
          const structuredResponse: AIResponse = JSON.parse(data.text);
          if (structuredResponse.content && structuredResponse.description) {
            logger.log('AI Service: Successfully parsed structured JSON response from proxy for chat message');
            return structuredResponse;
          }
          // If JSON doesn't have expected structure, fall back to text mode
          logger.log('AI Service: Proxy JSON response missing expected fields, falling back to text mode');
          return { content: data.text, description: undefined };
        } catch (jsonError) {
          logger.log('AI Service: Proxy response is not JSON, treating as plain text');
          return { content: data.text, description: undefined };
        }
      } else if (data.content && typeof data.content === 'string') {
        // Non-structured proxy response (backward compatibility)
        logger.log('AI Service: Successfully received non-structured response from local proxy for chat message');
        return { content: data.content, description: undefined };
      }
    }

    // Handle regular provider responses
    if (data.text) {
      // Try to parse structured JSON response first
      try {
        const structuredResponse: AIResponse = JSON.parse(data.text);
        if (structuredResponse.content && structuredResponse.description) {
          return structuredResponse;
        }
        // If JSON doesn't have expected structure, fall back to text mode
        logger.log('AI Service: JSON response missing expected fields, falling back to text mode');
        return { content: data.text, description: undefined };
      } catch (jsonError) {
        // If JSON parsing fails, treat as plain text (backward compatibility)
        logger.log('AI Service: Response is not JSON, treating as plain text');
        return { content: data.text, description: undefined };
      }
    }

    // If neither format works, log error and return fallback
    logger.error('AI Service: Unknown chat message response format received:', data);
    throw new Error('Invalid AI response format received for chat message');
  } catch (error) {
    logger.error('AI Service: processChatMessage error:', error);
    throw error;
  }
};
