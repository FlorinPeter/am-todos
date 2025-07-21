import { loadSettings } from '../utils/localStorage';
import { AIResponse, AIResponseWithFallback, CommitMessageResponse, CommitMessageResponseWithFallback } from '../types';
import logger from '../utils/logger';
import { fetchJsonWithTimeout, TIMEOUT_VALUES } from '../utils/fetchWithTimeout';

// Dynamically determine the API URL based on the current hostname
const getApiUrl = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Use proxy when accessing via localhost in development
    return '/api/ai';
  } else {
    // In production, frontend and backend run in same container
    // Use relative URL to avoid protocol/port issues
    return '/api/ai';
  }
};

const AI_API_URL = getApiUrl();

const getAISettings = () => {
  const settings = loadSettings();
  if (!settings) {
    throw new Error('No settings configured. Please configure your settings in the application.');
  }

  const provider = settings.aiProvider || 'gemini';
  let apiKey: string;
  
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
  } else {
    throw new Error('Invalid AI provider configured. Please select a valid provider in the application settings.');
  }

  return {
    provider,
    apiKey,
    model: settings.aiModel || (provider === 'gemini' ? 'gemini-2.5-flash' : 'anthropic/claude-3.5-sonnet')
  };
};

export const generateInitialPlan = async (goal: string) => {
  try {
    const aiSettings = getAISettings();
    const apiUrl = getApiUrl();
    const data = await fetchJsonWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateInitialPlan',
        payload: { goal },
        provider: aiSettings.provider,
        apiKey: aiSettings.apiKey,
        model: aiSettings.model,
      }),
      timeout: TIMEOUT_VALUES.AI,
    });

    return data.text;
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
  logger.log('AI Service: Raw response from', provider, model, ':', rawResponse.substring(0, 200) + (rawResponse.length > 200 ? '...' : ''));
  
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

export const generateCommitMessage = async (changeDescription: string): Promise<CommitMessageResponseWithFallback> => {
  try {
    const aiSettings = getAISettings();
    const apiUrl = getApiUrl();
    const data = await fetchJsonWithTimeout(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateCommitMessage',
        payload: { changeDescription },
        provider: aiSettings.provider,
        apiKey: aiSettings.apiKey,
        model: aiSettings.model,
      }),
      timeout: TIMEOUT_VALUES.AI,
    });

    return parseCommitResponse(data.text, aiSettings.provider, aiSettings.model || 'default');
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
    const aiSettings = getAISettings();
    const apiUrl = getApiUrl();
    const data = await fetchJsonWithTimeout(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'processChatMessage',
      payload: { 
        message, 
        currentContent, 
        chatHistory 
      },
      provider: aiSettings.provider,
      apiKey: aiSettings.apiKey,
      model: aiSettings.model,
    }),
    timeout: TIMEOUT_VALUES.AI,
  });
    
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
  } catch (error) {
    logger.error('AI Service: processChatMessage error:', error);
    throw error;
  }
};
