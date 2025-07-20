import { loadSettings } from '../utils/localStorage';
import { AIResponse, AIResponseWithFallback } from '../types';
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

export const generateCommitMessage = async (changeDescription: string) => {
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

    return data.text;
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
