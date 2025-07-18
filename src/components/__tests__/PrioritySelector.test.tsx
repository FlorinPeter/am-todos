import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PrioritySelector from '../PrioritySelector';

describe('PrioritySelector', () => {
  const mockOnPriorityChange = vi.fn();

  beforeEach(() => {
    mockOnPriorityChange.mockClear();
  });

  it('renders with default priority (P3)', () => {
    render(
      <PrioritySelector 
        priority={3} 
        onPriorityChange={mockOnPriorityChange} 
      />
    );

    expect(screen.getByText('Priority:')).toBeInTheDocument();
    expect(screen.getByTitle('P3 - Medium')).toBeInTheDocument();
  });

  it('renders all priority levels correctly', () => {
    const priorities = [
      { value: 1, label: 'P1', description: 'Critical' },
      { value: 2, label: 'P2', description: 'High' },
      { value: 3, label: 'P3', description: 'Medium' },
      { value: 4, label: 'P4', description: 'Low' },
      { value: 5, label: 'P5', description: 'Lowest' }
    ];

    priorities.forEach(({ value, label, description }) => {
      const { rerender } = render(
        <PrioritySelector 
          priority={value} 
          onPriorityChange={mockOnPriorityChange} 
        />
      );

      expect(screen.getByTitle(`${label} - ${description}`)).toBeInTheDocument();

      rerender(<div />); // Clean up for next iteration
    });
  });

  it('handles invalid priority by defaulting to P3', () => {
    render(
      <PrioritySelector 
        priority={99} 
        onPriorityChange={mockOnPriorityChange} 
      />
    );

    expect(screen.getByTitle('P3 - Medium')).toBeInTheDocument();
  });

  it('shows dropdown on hover', () => {
    render(
      <PrioritySelector 
        priority={3} 
        onPriorityChange={mockOnPriorityChange} 
      />
    );

    const priorityButton = screen.getByTitle('P3 - Medium');
    
    // Initially dropdown should be invisible
    const dropdown = priorityButton.closest('.relative')?.querySelector('.absolute');
    expect(dropdown).toHaveClass('opacity-0', 'invisible');

    // Hover should make it visible (via CSS hover, hard to test in JSDOM)
    // But we can test that the dropdown content exists
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Lowest')).toBeInTheDocument();
  });

  it('calls onPriorityChange when priority is selected', () => {
    render(
      <PrioritySelector 
        priority={3} 
        onPriorityChange={mockOnPriorityChange} 
      />
    );

    // Find and click P1 button in dropdown
    const p1Button = screen.getByText('Critical').closest('button');
    fireEvent.click(p1Button!);

    expect(mockOnPriorityChange).toHaveBeenCalledWith(1);
  });

  it('calls onPriorityChange for different priorities', () => {
    render(
      <PrioritySelector 
        priority={3} 
        onPriorityChange={mockOnPriorityChange} 
      />
    );

    // Test clicking different priorities
    const priorities = [
      { text: 'Critical', value: 1 },
      { text: 'High', value: 2 },
      { text: 'Low', value: 4 },
      { text: 'Lowest', value: 5 }
    ];

    priorities.forEach(({ text, value }) => {
      const button = screen.getByText(text).closest('button');
      fireEvent.click(button!);
      expect(mockOnPriorityChange).toHaveBeenCalledWith(value);
    });

    expect(mockOnPriorityChange).toHaveBeenCalledTimes(4);
  });

  it('handles disabled state correctly', () => {
    render(
      <PrioritySelector 
        priority={3} 
        onPriorityChange={mockOnPriorityChange} 
        disabled={true}
      />
    );

    const priorityButton = screen.getByTitle('P3 - Medium');
    
    // Button should be disabled
    expect(priorityButton).toBeDisabled();
    expect(priorityButton).toHaveClass('opacity-50', 'cursor-not-allowed');

    // Dropdown should not be rendered when disabled
    const dropdown = priorityButton.closest('.relative')?.querySelector('.absolute');
    expect(dropdown).toBeNull();
  });

  it('shows correct colors for each priority', () => {
    const priorityColors = [
      { priority: 1, expectedClass: 'bg-red-600' },
      { priority: 2, expectedClass: 'bg-orange-600' },
      { priority: 3, expectedClass: 'bg-yellow-600' },
      { priority: 4, expectedClass: 'bg-blue-600' },
      { priority: 5, expectedClass: 'bg-gray-600' }
    ];

    priorityColors.forEach(({ priority, expectedClass }) => {
      const { rerender } = render(
        <PrioritySelector 
          priority={priority} 
          onPriorityChange={mockOnPriorityChange} 
        />
      );

      const button = screen.getByTitle(`P${priority} - ${priority === 1 ? 'Critical' : priority === 2 ? 'High' : priority === 3 ? 'Medium' : priority === 4 ? 'Low' : 'Lowest'}`);
      expect(button).toHaveClass(expectedClass);

      rerender(<div />); // Clean up for next iteration
    });
  });

  it('highlights selected priority in dropdown', () => {
    render(
      <PrioritySelector 
        priority={2} 
        onPriorityChange={mockOnPriorityChange} 
      />
    );

    // Find P2 button in dropdown
    const p2Button = screen.getByText('High').closest('button');
    
    // Should have the orange background color
    expect(p2Button).toHaveClass('bg-orange-600');
  });

  it('applies hover styles to non-selected items', () => {
    render(
      <PrioritySelector 
        priority={3} 
        onPriorityChange={mockOnPriorityChange} 
      />
    );

    // Find P1 button (not selected, so should have hover styles)
    const p1Button = screen.getByText('Critical').closest('button');
    
    // Should have hover classes for non-selected items
    expect(p1Button).toHaveClass('text-gray-300', 'hover:bg-gray-700');
  });
});