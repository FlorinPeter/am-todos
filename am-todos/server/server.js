require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3001;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json());

app.post('/api/gemini', async (req, res) => {
  const { action, payload } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'Missing action in request body' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    let prompt = '';
    let systemInstruction = '';

    switch (action) {
      case 'generateInitialPlan':
        systemInstruction = `You are an expert project manager and agile coach. Your task is to break down a high-level goal into a detailed, actionable checklist in GitHub Flavored Markdown format. Each item should be a clear, concise task. Use checkboxes for each item.`;
        prompt = `Generate a detailed checklist for the following goal: ${payload.goal}`;
        break;
      case 'generateCommitMessage':
        systemInstruction = `You are an expert at writing conventional commit messages. Given a description of a change, generate a concise and appropriate conventional commit message (e.g., feat: Add new feature, fix: Fix bug, docs: Update documentation).`;
        prompt = `Generate a conventional commit message for the following change: ${payload.changeDescription}`;
        break;
      case 'processChatMessage':
        systemInstruction = `You are an AI assistant helping users modify their task lists. Given a user's natural language request, the current markdown content, and chat history, return the updated markdown content with the requested changes applied.

Rules:
1. Return ONLY the updated markdown content, no explanations or additional text
2. Preserve the existing structure and formatting
3. Make precise changes based on the user's request
4. Handle requests like "add a step for...", "rephrase the second item...", "remove the third task...", etc.
5. Keep checkbox format intact: - [ ] for unchecked, - [x] for checked
6. Maintain proper markdown syntax`;
        prompt = `Current markdown content:
${payload.currentContent}

Chat history:
${payload.chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

User request: ${payload.message}

Please return the updated markdown content:`;
        break;
      // Add more cases for other AI actions as needed
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemInstruction }] } });
    const response = await result.response;
    const text = response.text();
    res.json({ text });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: 'Failed to get response from Gemini API' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
