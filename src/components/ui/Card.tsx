import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  key?: string | number;
}

const Card = ({ children, className = '', onClick }: CardProps) => {
  return (
    <div 
      className={`bg-white rounded-xl shadow-card hover:shadow-card-hover transition-shadow p-6 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
