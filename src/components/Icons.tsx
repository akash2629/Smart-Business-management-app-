import React from 'react';
import { cn } from '../lib/utils';

interface IconProps {
  size?: number;
  className?: string;
}

export const BdtSign = ({ size = 20, className = "" }: IconProps) => (
  <span 
    className={cn("inline-flex items-center justify-center leading-none select-none", className)}
    style={{ 
      width: size, 
      height: size, 
      fontSize: size * 1.1,
      fontFamily: 'serif',
      fontWeight: 'bold'
    }}
  >
    ৳
  </span>
);
