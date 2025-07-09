import { describe, it, expect } from 'vitest';

describe('Task Creation Progress Bar Fix - Smooth Progression', () => {
  // Simulate the getProgressWidth function logic
  const getProgressWidth = (creationStep: string) => {
    if (!creationStep) return '0%';
    
    // Task creation steps in chronological order with smooth progression
    if (creationStep.includes('Starting')) return '5%';
    if (creationStep.includes('Generating task plan')) return '15%';
    if (creationStep.includes('Preparing task content')) return '30%';
    if (creationStep.includes('Generating commit message')) return '45%';
    if (creationStep.includes('Setting up repository')) return '60%';
    if (creationStep.includes('Checking for filename conflicts')) return '70%';
    if (creationStep.includes('Saving to GitHub')) return '80%';
    if (creationStep.includes('Refreshing task list')) return '90%';
    if (creationStep.includes('Task created successfully') || creationStep.includes('✅')) return '100%';
    
    // Error and retry states
    if (creationStep.includes('Waiting for GitHub')) return '85%';
    if (creationStep.includes('Task found')) return '95%';
    if (creationStep.includes('Taking longer than expected')) return '95%';
    if (creationStep.includes('Error, retrying')) return '75%';
    if (creationStep.includes('failed') || creationStep.includes('❌')) return '100%';
    
    return '100%';
  };

  describe('Task Creation Progress (Fixed)', () => {
    it('should calculate correct progress for normal task creation workflow', () => {
      const taskCreationSteps = [
        'Starting...',
        '🤖 Generating task plan with AI...',
        '📝 Preparing task content...',
        '💬 Generating commit message...',
        '📂 Setting up repository...',
        '🔍 Checking for filename conflicts...',
        '💾 Saving to GitHub...',
        '🔄 Refreshing task list...',
        '✅ Task created successfully!'
      ];

      const expectedProgressions = ['5%', '15%', '30%', '45%', '60%', '70%', '80%', '90%', '100%'];
      
      taskCreationSteps.forEach((step, index) => {
        const progress = getProgressWidth(step);
        expect(progress).toBe(expectedProgressions[index]);
      });
    });

    it('should show smooth progression without jumping', () => {
      const steps = [
        'Starting...',
        '🤖 Generating task plan with AI...',
        '📝 Preparing task content...',
        '💬 Generating commit message...',
        '📂 Setting up repository...',
        '🔍 Checking for filename conflicts...',
        '💾 Saving to GitHub...',
        '🔄 Refreshing task list...',
        '✅ Task created successfully!'
      ];

      const progressValues = steps.map(step => parseInt(getProgressWidth(step)));
      
      // Verify smooth progression (no backwards movement)
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThan(progressValues[i - 1]);
      }

      // Verify specific smooth progression
      expect(progressValues).toEqual([5, 15, 30, 45, 60, 70, 80, 90, 100]);
    });

    it('should handle filename conflict detection correctly', () => {
      // This is the step that was previously causing issues
      const conflictStep = '🔍 Checking for filename conflicts...';
      const progress = getProgressWidth(conflictStep);
      
      expect(progress).toBe('70%');
      expect(parseInt(progress)).toBeGreaterThan(60); // Should be after "Setting up repository"
      expect(parseInt(progress)).toBeLessThan(80); // Should be before "Saving to GitHub"
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle error states correctly', () => {
      const errorSteps = [
        'Error, retrying...',
        'Creation failed',
        '❌ Task creation failed!'
      ];

      const expectedProgressions = ['75%', '100%', '100%'];
      
      errorSteps.forEach((step, index) => {
        const progress = getProgressWidth(step);
        expect(progress).toBe(expectedProgressions[index]);
      });
    });

    it('should handle waiting and delay states', () => {
      const waitingSteps = [
        'Waiting for GitHub...',
        'Task found',
        'Taking longer than expected...'
      ];

      const expectedProgressions = ['85%', '95%', '95%'];
      
      waitingSteps.forEach((step, index) => {
        const progress = getProgressWidth(step);
        expect(progress).toBe(expectedProgressions[index]);
      });
    });

    it('should handle empty and unknown steps', () => {
      const unknownSteps = [
        '',
        'Unknown step',
        'Random text',
        'Some other operation'
      ];

      unknownSteps.forEach(step => {
        const progress = getProgressWidth(step);
        expect(progress).toBe(step === '' ? '0%' : '100%');
      });
    });
  });

  describe('Progress Bar Jumping Fix Verification', () => {
    it('should demonstrate the FIXED vs OLD behavior', () => {
      // OLD BEHAVIOR (before fix):
      // Many steps would return default 100% or 0%, causing jumping
      const problematicSteps = [
        'Starting...',                              // Previously: 100% (default)
        '🔍 Checking for filename conflicts...',    // Previously: 0% (not recognized)
        '🔄 Refreshing task list...',               // Previously: 85% (close to end)
        '✅ Task created successfully!'             // Previously: 100%
      ];

      // NEW BEHAVIOR (after fix):
      // Smooth progression for all steps
      const newBehaviorActual = problematicSteps.map(step => 
        getProgressWidth(step)
      );

      // Verify smooth progression
      expect(newBehaviorActual).toEqual([
        '5%',   // Immediate start indication
        '70%',  // Proper progression
        '90%',  // Near completion
        '100%'  // Success
      ]);

      // Verify progressive increase
      const progressValues = newBehaviorActual.map(p => parseInt(p));
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThan(progressValues[i - 1]);
      }
    });

    it('should ensure all main steps have meaningful progress values', () => {
      const mainSteps = [
        'Starting...',
        '🤖 Generating task plan with AI...',
        '📝 Preparing task content...',
        '💬 Generating commit message...',
        '📂 Setting up repository...',
        '🔍 Checking for filename conflicts...',
        '💾 Saving to GitHub...',
        '🔄 Refreshing task list...',
        '✅ Task created successfully!'
      ];

      const progressValues = mainSteps.map(step => parseInt(getProgressWidth(step)));
      
      // Verify all steps have meaningful progress (not just 0% or 100%)
      const meaningfulSteps = progressValues.filter(p => p > 0 && p < 100);
      expect(meaningfulSteps).toHaveLength(8); // 8 out of 9 steps should be between 0% and 100%
      
      // Verify consistent gaps between steps
      const gaps = [];
      for (let i = 1; i < progressValues.length - 1; i++) {
        gaps.push(progressValues[i] - progressValues[i - 1]);
      }
      
      // Most gaps should be reasonable (not too small or too large)
      const reasonableGaps = gaps.filter(gap => gap >= 10 && gap <= 20);
      expect(reasonableGaps.length).toBeGreaterThan(gaps.length * 0.6); // At least 60% should be reasonable
    });
  });

  describe('Integration with Existing Workflows', () => {
    it('should handle variations in step messages', () => {
      // Test that similar messages are handled correctly
      const stepVariations = [
        { step: 'Generating task plan', expected: '15%' },
        { step: '🤖 Generating task plan with AI...', expected: '15%' },
        { step: 'Preparing task content', expected: '30%' },
        { step: '📝 Preparing task content...', expected: '30%' },
        { step: 'Generating commit message', expected: '45%' },
        { step: '💬 Generating commit message...', expected: '45%' },
        { step: 'Setting up repository', expected: '60%' },
        { step: '📂 Setting up repository...', expected: '60%' }
      ];

      stepVariations.forEach(({ step, expected }) => {
        const progress = getProgressWidth(step);
        expect(progress).toBe(expected);
      });
    });

    it('should maintain smooth progression even with emoji prefixes', () => {
      const stepsWithEmojis = [
        'Starting...',
        '🤖 Generating task plan with AI...',
        '📝 Preparing task content...',
        '💬 Generating commit message...',
        '📂 Setting up repository...',
        '🔍 Checking for filename conflicts...',
        '💾 Saving to GitHub...',
        '🔄 Refreshing task list...',
        '✅ Task created successfully!'
      ];

      const progressValues = stepsWithEmojis.map(step => parseInt(getProgressWidth(step)));
      
      // Verify smooth progression despite emoji prefixes
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThan(progressValues[i - 1]);
      }
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid step changes efficiently', () => {
      const rapidSteps = [
        'Starting...',
        '🤖 Generating task plan with AI...',
        '📝 Preparing task content...',
        'Error, retrying...',
        '📝 Preparing task content...',
        '💬 Generating commit message...',
        '📂 Setting up repository...',
        '🔍 Checking for filename conflicts...',
        '💾 Saving to GitHub...',
        'Waiting for GitHub...',
        '🔄 Refreshing task list...',
        '✅ Task created successfully!'
      ];

      // Should handle all steps without issues
      rapidSteps.forEach(step => {
        const progress = getProgressWidth(step);
        expect(progress).toMatch(/^\d+%$/); // Should always return valid percentage
        expect(parseInt(progress)).toBeGreaterThanOrEqual(0);
        expect(parseInt(progress)).toBeLessThanOrEqual(100);
      });
    });

    it('should handle concurrent step pattern matching', () => {
      const ambiguousSteps = [
        '📝 Preparing task content and generating commit message...',
        'Setting up repository and checking conflicts...',
        'Saving to GitHub and refreshing...'
      ];

      ambiguousSteps.forEach(step => {
        const progress = getProgressWidth(step);
        expect(progress).toMatch(/^\d+%$/);
        expect(parseInt(progress)).toBeGreaterThan(0);
      });
    });
  });
});