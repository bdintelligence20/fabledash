import React, { ReactNode, useState } from 'react';

interface Tab {
  id: string;
  label: string | ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  defaultTabId?: string;
  onChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  fullWidth?: boolean;
  className?: string;
  tabClassName?: string;
  contentClassName?: string;
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTabId,
  onChange,
  variant = 'default',
  fullWidth = false,
  className = '',
  tabClassName = '',
  contentClassName = '',
}) => {
  const [activeTabId, setActiveTabId] = useState(defaultTabId || (tabs.length > 0 ? tabs[0].id : ''));

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
    if (onChange) {
      onChange(tabId);
    }
  };

  const getTabStyles = (tab: Tab) => {
    const isActive = tab.id === activeTabId;
    const isDisabled = tab.disabled;

    const baseClasses = 'px-4 py-2 font-medium transition-colors focus:outline-none';
    const widthClasses = fullWidth ? 'flex-1 text-center' : '';
    const disabledClasses = isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer';

    let variantClasses = '';
    if (variant === 'default') {
      variantClasses = isActive
        ? 'text-primary-600 border-b-2 border-primary-500'
        : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300';
    } else if (variant === 'pills') {
      variantClasses = isActive
        ? 'bg-primary-100 text-primary-700 rounded-lg'
        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg';
    } else if (variant === 'underline') {
      variantClasses = isActive
        ? 'text-primary-600 border-b-2 border-primary-500'
        : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent';
    }

    return `${baseClasses} ${widthClasses} ${variantClasses} ${disabledClasses} ${tabClassName}`;
  };

  const getTabsContainerStyles = () => {
    let variantClasses = '';
    if (variant === 'default' || variant === 'underline') {
      variantClasses = 'border-b border-gray-200';
    }

    return `flex ${variantClasses} ${className}`;
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  return (
    <div>
      <div className={getTabsContainerStyles()}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={getTabStyles(tab)}
            onClick={() => !tab.disabled && handleTabClick(tab.id)}
            disabled={tab.disabled}
            role="tab"
            aria-selected={tab.id === activeTabId}
            aria-controls={`tabpanel-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={`py-4 ${contentClassName}`} role="tabpanel" id={`tabpanel-${activeTabId}`}>
        {activeTab?.content}
      </div>
    </div>
  );
};

export default Tabs;
