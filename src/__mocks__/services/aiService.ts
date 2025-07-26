// Mock implementation of AI service for testing
import { vi } from 'vitest';

export const generateInitialPlan = vi.fn().mockResolvedValue('- [ ] Mock generated task\n- [ ] Another mock task');

export const generateCommitMessage = vi.fn().mockResolvedValue({
  message: 'feat: Mock commit message',
  description: 'Generated mock commit message for testing'
});

export const processChatMessage = vi.fn().mockResolvedValue({
  content: 'Updated content with mock AI response',
  description: 'Mock AI response for testing'
});