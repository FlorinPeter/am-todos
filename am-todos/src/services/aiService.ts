const AI_API_URL = '/api/gemini';

export const generateInitialPlan = async (goal: string) => {
  console.log('AI Service: Generating initial plan for goal:', goal);
  
  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateInitialPlan',
        payload: { goal },
      }),
    });

    console.log('AI Service: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Service error response:', errorText);
      throw new Error(`AI API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('AI Service: Plan generated successfully, length:', data.text?.length || 0);
    return data.text;
  } catch (error) {
    console.error('AI Service: Network or fetch error:', error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Unable to connect to AI service. Please check if the backend server is running.');
    }
    throw error;
  }
};

export const generateCommitMessage = async (changeDescription: string) => {
  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateCommitMessage',
        payload: { changeDescription },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Service commit message error:', errorText);
      throw new Error(`AI API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error('AI Service: Commit message generation error:', error);
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
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.text;
};
