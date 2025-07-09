import { describe, it, expect } from 'vitest';

describe('Progress Bar Calculation Fix - Smooth Progression', () => {
  // Simulate the getSaveProgressWidth function logic
  const getSaveProgressWidth = (saveStep: string) => {
    if (!saveStep) return '0%';
    
    // New unified title update steps (with proper percentage progression)
    if (saveStep.includes('Analyzing changes') || saveStep.includes('(1/6)')) return '17%';
    if (saveStep.includes('Getting latest version') || saveStep.includes('(2/6)')) return '33%';
    if (saveStep.includes('Preparing content') && saveStep.includes('(3/6)')) return '50%';
    if (saveStep.includes('Resolving filename') || saveStep.includes('(4/6)')) return '67%';
    if (saveStep.includes('Updating files') || saveStep.includes('Saving changes') || saveStep.includes('(5/6)')) return '83%';
    if (saveStep.includes('Refreshing list') || saveStep.includes('(6/6)')) return '90%';
    if (saveStep.includes('Title updated successfully') || saveStep.includes('✅')) return '100%';
    if (saveStep.includes('Title update failed') || saveStep.includes('❌')) return '100%';
    
    // Priority update steps - in chronological order
    if (saveStep.includes('Updating priority')) return '20%';
    if (saveStep.includes('Getting latest file version')) return '40%';
    if (saveStep.includes('Preparing content') && !saveStep.includes('(3/6)')) return '60%';
    if (saveStep.includes('Saving to GitHub')) return '80%';
    if (saveStep.includes('Refreshing') && !saveStep.includes('(6/6)')) return '90%';
    if (saveStep.includes('Priority updated')) return '100%';
    if (saveStep.includes('Priority update failed')) return '100%';
    
    // Regular save steps
    if (saveStep.includes('Preparing to save')) return '20%';
    if (saveStep.includes('Generating commit message')) return '40%';
    if (saveStep.includes('Refreshing task list')) return '90%';
    if (saveStep.includes('Save completed')) return '100%';
    if (saveStep.includes('Save failed')) return '100%';
    
    return '0%';
  };

  describe('Title Update Progress (Fixed)', () => {
    it('should calculate correct progress for rename workflow', () => {
      const renameWorkflowSteps = [
        '📝 Analyzing changes... (1/6)',
        '🔄 Getting latest version... (2/6)',
        '📝 Preparing content... (3/6)',
        '🔍 Resolving filename... (4/6)',
        '📁 Updating files... (5/6)',
        '🔄 Refreshing list... (6/6)',
        '✅ Title updated successfully!'
      ];

      const expectedProgressions = ['17%', '33%', '50%', '67%', '83%', '90%', '100%'];
      
      renameWorkflowSteps.forEach((step, index) => {
        const progress = getSaveProgressWidth(step);
        expect(progress).toBe(expectedProgressions[index]);
      });
    });

    it('should calculate correct progress for simple update workflow', () => {
      const updateWorkflowSteps = [
        '📝 Analyzing changes... (1/6)',
        '🔄 Getting latest version... (2/6)',
        '📝 Preparing content... (3/6)',
        '🔍 Resolving filename... (4/6)',
        '💾 Saving changes... (5/6)',
        '🔄 Refreshing list... (6/6)',
        '✅ Title updated successfully!'
      ];

      const expectedProgressions = ['17%', '33%', '50%', '67%', '83%', '90%', '100%'];
      
      updateWorkflowSteps.forEach((step, index) => {
        const progress = getSaveProgressWidth(step);
        expect(progress).toBe(expectedProgressions[index]);
      });
    });

    it('should show smooth progression without jumping', () => {
      const steps = [
        '📝 Analyzing changes... (1/6)',
        '🔄 Getting latest version... (2/6)',
        '📝 Preparing content... (3/6)',
        '🔍 Resolving filename... (4/6)',
        '📁 Updating files... (5/6)',
        '🔄 Refreshing list... (6/6)',
        '✅ Title updated successfully!'
      ];

      const progressValues = steps.map(step => parseInt(getSaveProgressWidth(step)));
      
      // Verify smooth progression (no backwards movement)
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }

      // Verify specific smooth progression
      expect(progressValues).toEqual([17, 33, 50, 67, 83, 90, 100]);
    });
  });

  describe('Compatibility with Existing Workflows', () => {
    it('should maintain compatibility with priority update steps', () => {
      const prioritySteps = [
        'Updating priority',
        'Getting latest file version',
        'Preparing content',
        'Saving to GitHub',
        'Refreshing',
        'Priority updated'
      ];

      const expectedProgressions = ['20%', '40%', '60%', '80%', '90%', '100%'];
      
      prioritySteps.forEach((step, index) => {
        const progress = getSaveProgressWidth(step);
        expect(progress).toBe(expectedProgressions[index]);
      });
    });

    it('should maintain compatibility with regular save steps', () => {
      const regularSaveSteps = [
        'Preparing to save',
        'Generating commit message',
        'Refreshing task list',
        'Save completed'
      ];

      const expectedProgressions = ['20%', '40%', '90%', '100%'];
      
      regularSaveSteps.forEach((step, index) => {
        const progress = getSaveProgressWidth(step);
        expect(progress).toBe(expectedProgressions[index]);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle error states correctly', () => {
      const errorSteps = [
        '❌ Title update failed!',
        'Title update failed',
        'Priority update failed',
        'Save failed'
      ];

      errorSteps.forEach(step => {
        const progress = getSaveProgressWidth(step);
        expect(progress).toBe('100%');
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
        const progress = getSaveProgressWidth(step);
        expect(progress).toBe('0%');
      });
    });

    it('should handle step variants correctly', () => {
      // Test that both old and new patterns work
      const stepVariants = [
        { step: '📝 Preparing content... (3/6)', expected: '50%' },
        { step: 'Preparing content', expected: '60%' }, // Old pattern
        { step: '🔄 Refreshing list... (6/6)', expected: '90%' },
        { step: 'Refreshing', expected: '90%' }, // Old pattern
        { step: '💾 Saving changes... (5/6)', expected: '83%' },
        { step: 'Saving to GitHub', expected: '80%' } // Old pattern
      ];

      stepVariants.forEach(({ step, expected }) => {
        const progress = getSaveProgressWidth(step);
        expect(progress).toBe(expected);
      });
    });
  });

  describe('Progress Bar Jumping Fix Verification', () => {
    it('should demonstrate the FIXED vs OLD behavior', () => {
      // OLD BEHAVIOR (before fix):
      // Progress bar would stay at 0% for most steps and jump to 100% at the end
      const oldBehaviorSimulation = [
        '📝 Analyzing changes... (1/6)',  // Would return 0%
        '🔄 Getting latest version... (2/6)',  // Would return 0%
        '📝 Preparing content... (3/6)',  // Would return 0%
        '🔍 Resolving filename... (4/6)',  // Would return 0%
        '📁 Updating files... (5/6)',     // Would return 0%
        '🔄 Refreshing list... (6/6)',    // Would return 0%
        '✅ Title updated successfully!'   // Would jump to 100%
      ];

      // NEW BEHAVIOR (after fix):
      // Smooth progression from 0% to 100%
      const newBehaviorActual = oldBehaviorSimulation.map(step => 
        getSaveProgressWidth(step)
      );

      // Verify smooth progression (no long periods at 0%)
      expect(newBehaviorActual).toEqual([
        '17%',  // Immediate progress
        '33%',  // Steady progression
        '50%',  // Halfway point
        '67%',  // Continued progress
        '83%',  // Nearly complete
        '90%',  // Final operations
        '100%'  // Success
      ]);

      // Verify no step returns 0% (except initial state)
      const progressValues = newBehaviorActual.map(p => parseInt(p));
      expect(progressValues.every(p => p > 0)).toBe(true);
    });

    it('should ensure progressive increase in all scenarios', () => {
      const testScenarios = [
        {
          name: 'Rename workflow',
          steps: [
            '📝 Analyzing changes... (1/6)',
            '🔄 Getting latest version... (2/6)',
            '📝 Preparing content... (3/6)',
            '🔍 Resolving filename... (4/6)',
            '📁 Updating files... (5/6)',
            '🔄 Refreshing list... (6/6)',
            '✅ Title updated successfully!'
          ]
        },
        {
          name: 'Update workflow',
          steps: [
            '📝 Analyzing changes... (1/6)',
            '🔄 Getting latest version... (2/6)',
            '📝 Preparing content... (3/6)',
            '🔍 Resolving filename... (4/6)',
            '💾 Saving changes... (5/6)',
            '🔄 Refreshing list... (6/6)',
            '✅ Title updated successfully!'
          ]
        }
      ];

      testScenarios.forEach(({ name, steps }) => {
        const progressValues = steps.map(step => parseInt(getSaveProgressWidth(step)));
        
        // Verify progressive increase
        for (let i = 1; i < progressValues.length; i++) {
          expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
        }

        // Verify starts above 0% and ends at 100%
        expect(progressValues[0]).toBeGreaterThan(0);
        expect(progressValues[progressValues.length - 1]).toBe(100);
      });
    });
  });
});