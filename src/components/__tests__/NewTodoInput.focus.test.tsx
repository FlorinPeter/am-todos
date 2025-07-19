import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import NewTodoInput from '../NewTodoInput';

describe('NewTodoInput - Focus Management', () => {
  let mockOnGoalSubmit: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnGoalSubmit = vi.fn();
    mockOnCancel = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should focus input field with timing delay to handle modal rendering', async () => {
    render(
      <NewTodoInput 
        onGoalSubmit={mockOnGoalSubmit}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText(/enter a new high-level goal/i);
    
    // Fast-forward the timer to trigger the focus
    vi.advanceTimersByTime(100);

    // The input should be focused after the timer delay
    expect(document.activeElement).toBe(input);
  });

  it('should handle focus timing correctly even if component unmounts', async () => {
    const { unmount } = render(
      <NewTodoInput 
        onGoalSubmit={mockOnGoalSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Unmount before timer fires to test cleanup
    unmount();

    // Advance timer - should not cause any errors due to cleanup
    expect(() => {
      vi.advanceTimersByTime(100);
    }).not.toThrow();
  });

  it('should only focus if input ref exists', async () => {
    // Mock console.error to catch any potential errors
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <NewTodoInput 
        onGoalSubmit={mockOnGoalSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Fast-forward timer
    vi.advanceTimersByTime(100);

    // Should not have any errors
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should work correctly in real-time without fake timers', async () => {
    vi.useRealTimers();

    render(
      <NewTodoInput 
        onGoalSubmit={mockOnGoalSubmit}
        onCancel={mockOnCancel}
      />
    );

    const input = screen.getByPlaceholderText(/enter a new high-level goal/i);

    // Wait for the focus to be applied (real timing)
    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    }, { timeout: 200 }); // Give it 200ms to account for the 100ms delay
  });
});