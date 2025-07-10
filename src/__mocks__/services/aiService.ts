// Mock implementation of AI service for testing

export const generateInitialPlan = jest.fn().mockResolvedValue('- [ ] Mock generated task\n- [ ] Another mock task');

export const generateCommitMessage = jest.fn().mockResolvedValue('feat: Mock commit message');

export const processChatMessage = jest.fn().mockResolvedValue('Updated content with mock AI response');