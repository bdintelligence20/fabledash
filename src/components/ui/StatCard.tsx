import React, { ReactNode } from 'react';
import Card from './Card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  className?: string;
  bgColor?: string;
  textColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  className = '',
  bgColor = 'bg-primary-500',
  textColor = 'text-white'
}) => {
  return (
    <Card className={`${className} ${bgColor} ${textColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium opacity-90 uppercase">{title}</h3>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        {icon && (
          <div className="opacity-80">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

export default StatCard;
