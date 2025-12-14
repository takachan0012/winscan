'use client';
import { Star, TrendingUp } from 'lucide-react';

interface SponsoredBadgeProps {
  variant?: 'default' | 'compact' | 'tooltip';
  showIcon?: boolean;
  className?: string;
}

export default function SponsoredBadge({ 
  variant = 'default', 
  showIcon = true,
  className = '' 
}: SponsoredBadgeProps) {
  
  if (variant === 'compact') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded text-[9px] font-bold text-yellow-400 uppercase tracking-wide ${className}`}>
        {showIcon && <Star className="w-2.5 h-2.5 fill-yellow-400" />}
        Sponsored
      </span>
    );
  }

  if (variant === 'tooltip') {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <div className="relative group">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 animate-pulse" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-yellow-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Sponsored Validator
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10 border border-yellow-500/30 rounded-lg ${className}`}>
      {showIcon && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
      <span className="text-xs font-bold text-yellow-400 uppercase tracking-wide">Sponsored</span>
      <TrendingUp className="w-3 h-3 text-yellow-400" />
    </div>
  );
}
