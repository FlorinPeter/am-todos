import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock localStorage before importing the functions
const mockLocalStorage = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockLocalStorage.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage.store[key];
  }),
  clear: vi.fn(() => {
    mockLocalStorage.store = {};
  })
};

// Mock the global localStorage
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Now import the functions
import { 
  saveCheckpoint, 
  getCheckpoints, 
  clearCheckpoints, 
  generateCheckpointId,
  Checkpoint 
} from '../localStorage';

describe('Checkpoint localStorage functions', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('generateCheckpointId', () => {
    it('generates unique checkpoint IDs', () => {
      const id1 = generateCheckpointId();
      const id2 = generateCheckpointId();
      
      expect(id1).toMatch(/^checkpoint_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^checkpoint_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('follows the expected format', () => {
      const id = generateCheckpointId();
      expect(id).toMatch(/^checkpoint_\d{13}_[a-z0-9]{9}$/);
    });
  });

  describe('saveCheckpoint', () => {
    const mockCheckpoint: Checkpoint = {
      id: 'test-checkpoint-1',
      content: '# Test Content\n\n- [ ] Task 1',
      timestamp: '2023-01-01T12:00:00.000Z',
      chatMessage: 'Add a new task',
      description: 'Add a new task'
    };

    it('saves checkpoint to localStorage', () => {
      saveCheckpoint('task-1', mockCheckpoint);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'checkpoints_task-1',
        JSON.stringify([mockCheckpoint])
      );
    });

    it('appends to existing checkpoints', () => {
      const existingCheckpoint: Checkpoint = {
        id: 'existing-checkpoint',
        content: '# Existing Content',
        timestamp: '2023-01-01T11:00:00.000Z',
        chatMessage: 'Previous task',
        description: 'Previous task'
      };

      // Set up existing checkpoint
      mockLocalStorage.store['checkpoints_task-1'] = JSON.stringify([existingCheckpoint]);
      
      saveCheckpoint('task-1', mockCheckpoint);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'checkpoints_task-1',
        JSON.stringify([existingCheckpoint, mockCheckpoint])
      );
    });

    it('limits checkpoints to 20 items', () => {
      // Create 21 checkpoints
      const checkpoints: Checkpoint[] = [];
      for (let i = 0; i < 21; i++) {
        checkpoints.push({
          id: `checkpoint-${i}`,
          content: `Content ${i}`,
          timestamp: new Date().toISOString(),
          chatMessage: `Message ${i}`,
          description: `Description ${i}`
        });
      }

      // Save all checkpoints one by one
      checkpoints.forEach(cp => saveCheckpoint('task-1', cp));

      // Get the final state
      const savedCheckpoints = getCheckpoints('task-1');
      
      expect(savedCheckpoints).toHaveLength(20);
      expect(savedCheckpoints[0].id).toBe('checkpoint-1'); // First one should be removed
      expect(savedCheckpoints[19].id).toBe('checkpoint-20'); // Last one should be kept
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage full');
      });

      expect(() => saveCheckpoint('task-1', mockCheckpoint)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error saving checkpoint to localStorage',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getCheckpoints', () => {
    it('returns empty array when no checkpoints exist', () => {
      const checkpoints = getCheckpoints('non-existent-task');
      expect(checkpoints).toEqual([]);
    });

    it('returns stored checkpoints', () => {
      const mockCheckpoints: Checkpoint[] = [
        {
          id: 'checkpoint-1',
          content: '# Content 1',
          timestamp: '2023-01-01T12:00:00.000Z',
          chatMessage: 'Message 1',
          description: 'Description 1'
        },
        {
          id: 'checkpoint-2',
          content: '# Content 2',
          timestamp: '2023-01-01T13:00:00.000Z',
          chatMessage: 'Message 2',
          description: 'Description 2'
        }
      ];

      mockLocalStorage.store['checkpoints_task-1'] = JSON.stringify(mockCheckpoints);
      
      const checkpoints = getCheckpoints('task-1');
      expect(checkpoints).toEqual(mockCheckpoints);
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const checkpoints = getCheckpoints('task-1');
      expect(checkpoints).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading checkpoints from localStorage',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('handles corrupted JSON data gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.store['checkpoints_task-1'] = 'invalid json';
      
      const checkpoints = getCheckpoints('task-1');
      expect(checkpoints).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading checkpoints from localStorage',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('clearCheckpoints', () => {
    it('removes checkpoints from localStorage', () => {
      mockLocalStorage.store['checkpoints_task-1'] = JSON.stringify([]);
      
      clearCheckpoints('task-1');
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('checkpoints_task-1');
      expect(mockLocalStorage.store['checkpoints_task-1']).toBeUndefined();
    });

    it('handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(() => clearCheckpoints('task-1')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error clearing checkpoints from localStorage',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Integration scenarios', () => {
    it('handles complete workflow: save -> get -> clear', () => {
      const checkpoint: Checkpoint = {
        id: 'test-checkpoint',
        content: '# Test Content',
        timestamp: new Date().toISOString(),
        chatMessage: 'Test message',
        description: 'Test description'
      };

      // Save checkpoint
      saveCheckpoint('workflow-test', checkpoint);
      
      // Verify localStorage was called correctly
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'checkpoints_workflow-test',
        JSON.stringify([checkpoint])
      );
      
      // Mock the return value for getCheckpoints
      mockLocalStorage.store['checkpoints_workflow-test'] = JSON.stringify([checkpoint]);
      
      // Get checkpoint
      const retrieved = getCheckpoints('workflow-test');
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toEqual(checkpoint);
      
      // Clear checkpoints
      clearCheckpoints('workflow-test');
      
      // Verify cleared
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('checkpoints_workflow-test');
      const afterClear = getCheckpoints('workflow-test');
      expect(afterClear).toEqual([]);
    });

    it('maintains separate checkpoints for different tasks', () => {
      const checkpoint1: Checkpoint = {
        id: 'checkpoint-1',
        content: 'Content 1',
        timestamp: new Date().toISOString(),
        chatMessage: 'Message 1',
        description: 'Description 1'
      };

      const checkpoint2: Checkpoint = {
        id: 'checkpoint-2',
        content: 'Content 2',
        timestamp: new Date().toISOString(),
        chatMessage: 'Message 2',
        description: 'Description 2'
      };

      saveCheckpoint('task-1', checkpoint1);
      saveCheckpoint('task-2', checkpoint2);

      // Set up the mock store
      mockLocalStorage.store['checkpoints_task-1'] = JSON.stringify([checkpoint1]);
      mockLocalStorage.store['checkpoints_task-2'] = JSON.stringify([checkpoint2]);

      expect(getCheckpoints('task-1')).toEqual([checkpoint1]);
      expect(getCheckpoints('task-2')).toEqual([checkpoint2]);

      clearCheckpoints('task-1');
      delete mockLocalStorage.store['checkpoints_task-1'];
      
      expect(getCheckpoints('task-1')).toEqual([]);
      expect(getCheckpoints('task-2')).toEqual([checkpoint2]);
    });
  });
});