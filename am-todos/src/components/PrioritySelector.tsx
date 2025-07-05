import React from 'react';

interface PrioritySelectorProps {
  priority: number;
  onPriorityChange: (newPriority: number) => void;
  disabled?: boolean;
}

const PrioritySelector: React.FC<PrioritySelectorProps> = ({ 
  priority, 
  onPriorityChange, 
  disabled = false 
}) => {
  const priorityLabels = {
    1: { label: 'P1', color: 'bg-red-600 text-white', description: 'Critical' },
    2: { label: 'P2', color: 'bg-orange-600 text-white', description: 'High' },
    3: { label: 'P3', color: 'bg-yellow-600 text-white', description: 'Medium' },
    4: { label: 'P4', color: 'bg-blue-600 text-white', description: 'Low' },
    5: { label: 'P5', color: 'bg-gray-600 text-white', description: 'Lowest' }
  };

  const currentPriority = priorityLabels[priority as keyof typeof priorityLabels] || priorityLabels[3];

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-400">Priority:</span>
      <div className="relative group">
        <button
          disabled={disabled}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${
            currentPriority.color
          } ${
            disabled 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:opacity-80 cursor-pointer'
          }`}
          title={`${currentPriority.label} - ${currentPriority.description}`}
        >
          {currentPriority.label}
        </button>
        
        {!disabled && (
          <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
            <div className="p-2 space-y-1">
              {Object.entries(priorityLabels).map(([value, config]) => (
                <button
                  key={value}
                  onClick={() => onPriorityChange(parseInt(value))}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors duration-150 ${
                    parseInt(value) === priority
                      ? `${config.color} opacity-100`
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="font-medium">{config.label}</span>
                  <span className="ml-2 text-xs opacity-75">{config.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrioritySelector;