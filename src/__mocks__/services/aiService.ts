// Mock implementation of AI service for testing

export const generateInitialPlan = jest.fn().mockResolvedValue('- [ ] Mock generated task\n- [ ] Another mock task');

export const generateCommitMessage = jest.fn().mockResolvedValue({
  message: 'feat: Mock commit message',
  description: 'Generated mock commit message for testing'
});

export const processChatMessage = jest.fn().mockResolvedValue({
  content: 'Updated content with mock AI response',
  description: 'Mock AI response for testing'
});