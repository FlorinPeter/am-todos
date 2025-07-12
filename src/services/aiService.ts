import { loadSettings } from '../utils/localStorage';
import logger from '../utils/logger';

const AI_API_URL = '/api/ai';

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
  logger.log('AI Service: Generating initial plan for goal:', goal);
  
  try {
    const aiSettings = getAISettings();
    const response = await fetch(AI_API_URL, {
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
    });

    logger.log('AI Service: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('AI Service error response:', errorText);
      throw new Error(`AI API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    logger.log('AI Service: Plan generated successfully, length:', data.text?.length || 0);
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
    const response = await fetch(AI_API_URL, {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('AI Service commit message error:', errorText);
      throw new Error(`AI API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
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
) => {
  const aiSettings = getAISettings();
  const response = await fetch(AI_API_URL, {
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
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.text;
};
