import React, { ReactNode } from 'react';

interface Column<T> {
  key: string;
  header: string | ReactNode;
  render?: (item: T, index: number) => ReactNode;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyState?: ReactNode;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  className?: string;
  rowClassName?: string | ((item: T, index: number) => string);
  headerClassName?: string;
  bodyClassName?: string;
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  compact?: boolean;
}

function Table<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  isLoading = false,
  emptyState,
  sortColumn,
  sortDirection = 'asc',
  onSort,
  className = '',
  rowClassName = '',
  headerClassName = '',
  bodyClassName = '',
  striped = false,
  hoverable = true,
  bordered = false,
  compact = false,
}: TableProps<T>) {
  // Base classes
  const tableClasses = `w-full ${bordered ? 'border border-gray-200' : ''} ${className}`;
  const headerClasses = `bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
    bordered ? 'border-b border-gray-200' : ''
  } ${headerClassName}`;
  const bodyClasses = `bg-white divide-y divide-gray-200 ${bodyClassName}`;
  
  // Cell padding based on compact prop
  const cellPadding = compact ? 'px-3 py-2' : 'px-6 py-4';
  
  // Get row classes
  const getRowClasses = (item: T, index: number) => {
    const baseClasses = [
      striped && index % 2 === 1 ? 'bg-gray-50' : '',
      hoverable ? 'hover:bg-gray-100' : '',
      onRowClick ? 'cursor-pointer' : '',
      typeof rowClassName === 'function' ? rowClassName(item, index) : rowClassName,
    ].filter(Boolean).join(' ');
    
    return baseClasses;
  };
  
  // Get cell alignment classes
  const getCellAlignmentClasses = (align: 'left' | 'center' | 'right' = 'left') => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };
  
  // Render sort indicator
  const renderSortIndicator = (column: Column<T>) => {
    if (!column.sortable) return null;
    
    if (sortColumn === column.key) {
      return (
        <span className="ml-1 inline-block">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      );
    }
    
    return <span className="ml-1 inline-block text-gray-300">↕</span>;
  };
  
  // Handle header click for sorting
  const handleHeaderClick = (column: Column<T>) => {
    if (column.sortable && onSort) {
      onSort(column.key);
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="w-full">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-16 bg-gray-100 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }
  
  // Empty state
  if (data.length === 0) {
    return (
      <div className="w-full border border-gray-200 rounded-lg p-8">
        {emptyState || (
          <div className="text-center">
            <p className="text-gray-500">No data available</p>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <table className={tableClasses}>
        <thead className={headerClasses}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`${cellPadding} ${getCellAlignmentClasses(column.align)} ${
                  column.sortable ? 'cursor-pointer select-none' : ''
                }`}
                style={{ width: column.width }}
                onClick={() => column.sortable && handleHeaderClick(column)}
              >
                <div className="flex items-center">
                  {column.header}
                  {renderSortIndicator(column)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={bodyClasses}>
          {data.map((item, index) => (
            <tr
              key={keyExtractor(item)}
              className={getRowClasses(item, index)}
              onClick={() => onRowClick && onRowClick(item)}
            >
              {columns.map((column) => (
                <td
                  key={`${keyExtractor(item)}-${column.key}`}
                  className={`${cellPadding} ${getCellAlignmentClasses(column.align)} whitespace-nowrap`}
                >
                  {column.render ? column.render(item, index) : (item as any)[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
