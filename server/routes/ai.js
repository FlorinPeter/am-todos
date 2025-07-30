import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import logger from '../logger.js';
import { 
  requiresStructuredOutput, 
  getSystemPromptForAction, 
  getJsonSchemaForAction 
} from '../services/localProxy.js';
import { processLocalProxyRequest } from '../services/proxyManager.js';

const router = express.Router();

// AI API proxy endpoint with support for multiple providers
router.post('/api/ai', async (req, res) => {
  const { action, payload, provider, apiKey, model, proxyUuid, proxyLocalToken } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Missing action in request body' });
  }

  // ENHANCED DEBUGGING: Log all incoming request details
  logger.log('🔍 AI REQUEST DEBUG: Action:', action);
  logger.log('🔍 AI REQUEST DEBUG: Provider:', provider);
  logger.log('🔍 AI REQUEST DEBUG: Has API Key:', !!apiKey);
  logger.log('🔍 AI REQUEST DEBUG: Has Proxy UUID:', !!proxyUuid);
  logger.log('🔍 AI REQUEST DEBUG: Payload structure:', JSON.stringify(payload, null, 2));

  // Detect if structured output is needed (consistent across all providers)
  const structuredOutputNeeded = requiresStructuredOutput(action);

  // Check if user explicitly selected local proxy as AI provider
  if (provider === 'local-proxy') {
    logger.log('🏠 USER SELECTED LOCAL PROXY - Routing to local proxy');
    return await processLocalProxyRequest(req, res);
  }
  
  // Continue with regular AI processing for external providers
  if (!provider) {
    return res.status(400).json({ error: 'Missing AI provider. Please select a provider in the application settings.' });
  }

  // Validate based on provider type
  if (provider === 'gemini') {
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing Gemini API key. Please configure your API key in the application settings.' });
    }
    // Google Gemini API keys start with 'AIza' and contain only valid characters
    if (!apiKey.startsWith('AIza') || !/^AIza[a-zA-Z0-9_-]+$/.test(apiKey)) {
      return res.status(400).json({ error: 'Invalid Google Gemini API key format. Key should start with "AIza".' });
    }
  } else if (provider === 'openrouter') {
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing OpenRouter API key. Please configure your API key in the application settings.' });
    }
    // OpenRouter API keys start with 'sk-or-v1-' and are longer
    if (!apiKey.startsWith('sk-or-v1-') || apiKey.length < 20 || !/^sk-or-v1-[a-zA-Z0-9_-]+$/.test(apiKey)) {
      return res.status(400).json({ error: 'Invalid OpenRouter API key format. Key should start with "sk-or-v1-".' });
    }
  } else if (provider === 'local-proxy') {
    // This should not be reached due to early routing, but included for completeness
    return res.status(400).json({ error: 'Local proxy requests should be routed earlier in the flow.' });
  } else {
    return res.status(400).json({ error: 'Unsupported AI provider. Supported providers: gemini, openrouter, local-proxy' });
  }

  try {
    let prompt = '';
    let systemInstruction = '';
    let response;

    switch (action) {
      case 'generateInitialPlan':
        // Template-specific system prompts
        const templates = {
          general: `You are an expert project manager. Your task is to create a high-level, editable markdown template for a goal. Keep it simple and user-friendly - the user should be able to easily edit and expand on it.

Rules:
1. Return ONLY a JSON object with this exact structure: {"title": "extracted goal title", "content": "markdown checklist content"}
2. Create a brief description of the goal in the content
3. Add 3-5 high-level checkboxes using - [ ] format
4. Keep each checkbox item concise and general (not overly detailed)
5. Use simple GitHub Flavored Markdown in the content
6. Make it easy for the user to edit and add their own details
7. Focus on major phases or key areas rather than micro-tasks
8. Extract a clean, descriptive title from the goal (remove articles like "a", "the" and clean up the text)`,

          project: `You are an expert project manager specializing in comprehensive project planning. Create a structured project plan that covers all major phases of execution.

Rules:
1. Return ONLY a JSON object with this exact structure: {"title": "extracted project title", "content": "markdown checklist content"}
2. Include a brief project overview and objectives
3. Organize tasks into clear phases: Planning, Design/Development, Testing, Deployment, Post-Launch
4. Use - [ ] format for all actionable items
5. Include milestone checkpoints and deliverables
6. Focus on high-level activities that can be broken down later
7. Consider dependencies between phases
8. Extract a professional project title from the goal`,

          bugfix: `You are an expert software engineer specializing in bug investigation and resolution. Create a systematic debugging workflow.

Rules:
1. Return ONLY a JSON object with this exact structure: {"title": "extracted bug title", "content": "markdown checklist content"}
2. Start with problem analysis and reproduction steps
3. Include investigation tasks: logs review, environment check, code analysis
4. Add debugging and testing phases
5. Include fix verification and regression testing
6. Use - [ ] format for all diagnostic and fix steps
7. Focus on systematic troubleshooting methodology
8. Extract a clear bug description for the title`,

          feature: `You are an expert software engineer specializing in feature development. Create a comprehensive feature development plan.

Rules:
1. Return ONLY a JSON object with this exact structure: {"title": "extracted feature title", "content": "markdown checklist content"}
2. Include requirements analysis and design phase
3. Cover implementation, testing, and documentation tasks
4. Add code review and quality assurance steps
5. Include deployment and rollout considerations
6. Use - [ ] format for all development tasks
7. Focus on software development lifecycle phases
8. Extract a clear feature name for the title`,

          research: `You are an expert researcher who creates systematic investigation plans. Create a structured research methodology.

Rules:
1. Return ONLY a JSON object with this exact structure: {"title": "extracted research topic", "content": "markdown checklist content"}
2. Include research objectives and scope definition
3. Add information gathering and source analysis tasks
4. Include synthesis and documentation phases
5. Add validation and fact-checking steps
6. Use - [ ] format for all research activities
7. Focus on systematic investigation methodology
8. Extract a clear research topic for the title`,

          personal: `You are an expert personal productivity coach. Create a motivating and achievable personal goal plan.

Rules:
1. Return ONLY a JSON object with this exact structure: {"title": "extracted goal title", "content": "markdown checklist content"}
2. Include goal clarification and motivation
3. Break down into manageable, actionable steps
4. Add progress tracking and milestone celebration
5. Include reflection and adjustment phases
6. Use - [ ] format for all action items
7. Focus on personal development and achievement
8. Extract an inspiring goal title`
        };

        // Use template-specific system instruction or default to general
        const templateId = payload.template || 'general';
        systemInstruction = templates[templateId] || templates.general;
        
        // Build prompt with goal and optional description
        let promptParts = [];
        if (payload.title) {
          promptParts.push(`Title: ${payload.title}`);
        }
        if (payload.goal) {
          promptParts.push(`Goal: ${payload.goal}`);
        }
        if (payload.description) {
          promptParts.push(`Additional context: ${payload.description}`);
        }
        
        const promptContent = promptParts.length > 0 ? promptParts.join('\n') : payload.goal || payload.title;
        prompt = `Create a ${templateId === 'general' ? 'simple, high-level' : templateId + '-focused'} markdown template for this:

${promptContent}

Please return a JSON object with the title and markdown content:`;
        break;
      case 'generateCommitMessage':
        systemInstruction = getSystemPromptForAction('generateCommitMessage');
        prompt = `Generate a conventional commit message for the following change: ${payload.changeDescription}

Please return a JSON object with the commit message and description:`;
        break;
      case 'processChatMessage':
        systemInstruction = getSystemPromptForAction('processChatMessage');
        prompt = `Current markdown content:
${payload.currentContent}

Chat history:
${payload.chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

User request: ${payload.message}

Please return a JSON object with the updated markdown content and description of changes:`;
        break;
      // Add more cases for other AI actions as needed
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    if (provider === 'gemini') {
      // Gemini API implementation
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({ model: model || "gemini-2.5-flash" });
      
      // Use JSON mode for structured output when needed
      // Note: Gemini uses generationConfig instead of response_format (different from OpenAI API)
      const config = structuredOutputNeeded ? {
        generationConfig: { responseMimeType: "application/json" }
      } : {};

      // Development mode: Log Gemini request details
      if (process.env.NODE_ENV === 'development') {
        logger.log('🤖 GEMINI API REQUEST:', JSON.stringify({
          action,
          model: model || "gemini-2.5-flash",
          requiresStructuredOutput: structuredOutputNeeded,
          systemInstruction,
          prompt,
          config
        }, null, 2));
      }
      
      const result = await geminiModel.generateContent({ 
        contents: [{ role: "user", parts: [{ text: prompt }] }], 
        systemInstruction: { parts: [{ text: systemInstruction }] },
        ...config
      });
      
      // Defensive programming: Validate Gemini response structure
      if (!result || !result.response) {
        logger.error('Gemini API returned invalid result structure:', JSON.stringify(result, null, 2));
        throw new Error(`Gemini API returned invalid result. Expected 'result.response' but got: ${JSON.stringify(result)}`);
      }
      
      response = await result.response;
      
      if (!response || typeof response.text !== 'function') {
        logger.error('Gemini response missing text() method:', JSON.stringify(response, null, 2));
        throw new Error(`Gemini response invalid. Expected response.text() method but got: ${typeof response}`);
      }
      
      const text = response.text();
      
      // Validate text content
      if (typeof text !== 'string') {
        logger.error('Gemini response.text() returned non-string:', typeof text, text);
        throw new Error(`Gemini model "${model || "gemini-2.5-flash"}" returned non-string text: ${typeof text}`);
      }

      // Development mode: Log Gemini response details
      if (process.env.NODE_ENV === 'development') {
        logger.log('🤖 GEMINI API RESPONSE:', JSON.stringify({
          action,
          responseLength: text.length,
          fullResponse: text,
          isJSON: structuredOutputNeeded,
          success: true
        }, null, 2));
      }

      res.json({ text });
    } else if (provider === 'openrouter') {
      // OpenRouter API implementation using OpenAI client
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://agentic-markdown-todos.local',
          'X-Title': 'Agentic Markdown Todos'
        }
      });

      const requestParams = {
        model: model || 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        // Use JSON mode for structured output when needed
        ...(structuredOutputNeeded ? { 
          response_format: { 
            type: "json_schema", 
            json_schema: getJsonSchemaForAction(action)
          } 
        } : {})
      };

      // Development mode: Log OpenRouter request details
      if (process.env.NODE_ENV === 'development') {
        logger.log('🤖 OPENROUTER API REQUEST:', JSON.stringify({
          action,
          model: model || 'anthropic/claude-3.5-sonnet',
          requiresStructuredOutput: structuredOutputNeeded,
          systemInstruction,
          prompt,
          requestParams
        }, null, 2));
      }

      try {
        const completion = await openai.chat.completions.create(requestParams);
        
        // Extract the response content
        const text = completion.choices[0]?.message?.content;
        
        if (!text) {
          throw new Error('OpenRouter API returned empty response content');
        }

        // Development mode: Log OpenRouter response details  
        if (process.env.NODE_ENV === 'development') {
          logger.log('🤖 OPENROUTER API RESPONSE:', JSON.stringify({
            action,
            responseLength: text.length,
            fullResponse: text,
            isJSON: structuredOutputNeeded,
            usage: completion.usage,
            model: completion.model,
            success: true
          }, null, 2));
        }

        res.json({ text });
      } catch (error) {
        // Handle OpenAI library errors with user-friendly messages
        if (error.status === 401) {
          throw new Error('OpenRouter API key is invalid or not authorized. Please check your API key in settings.');
        } else if (error.status === 429) {
          throw new Error('OpenRouter API rate limit exceeded. Please try again later.');
        } else if (error.status === 400) {
          if (structuredOutputNeeded) {
            throw new Error('OpenRouter model does not support structured output (json_schema). Please use a compatible model like Claude, GPT-4, or other models that support JSON schema formatting.');
          } else {
            throw new Error('Invalid request to OpenRouter API. Please check your model selection and try again.');
          }
        } else if (error.status >= 500) {
          throw new Error('OpenRouter API service temporarily unavailable. Please try again later.');
        } else {
          throw new Error(`OpenRouter API error: ${error.message || error.toString()}`);
        }
      }
    } else {
      return res.status(400).json({ error: 'Unsupported AI provider' });
    }
  } catch (error) {
    logger.error(`Error calling ${provider} API:`, error);

    // Development mode: Enhanced error logging
    if (process.env.NODE_ENV === 'development') {
      logger.log('🤖 LLM API ERROR DETAILS:', JSON.stringify({
        provider,
        action,
        model,
        requiresStructuredOutput: structuredOutputNeeded,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      }, null, 2));
    }
    
    // Provide more specific error messages
    if (provider === 'gemini' && error.message?.includes('API key not valid')) {
      res.status(400).json({ error: 'Invalid Gemini API key. Please check your API key in settings and ensure it has the necessary permissions.' });
    } else if (provider === 'gemini' && error.message?.includes('model not found')) {
      res.status(400).json({ error: 'Gemini model not available. Try using a different model like "gemini-2.5-flash" or "gemini-1.5-pro".' });
    } else {
      res.status(500).json({ error: `Failed to get response from ${provider} API` });
    }
  }
});

export default router;