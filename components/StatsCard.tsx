'use client';
import { TrendingUp, TrendingDown } from 'lucide-react';
interface StatsCardProps {
  title: string;
  value: string;
  change?: number;
}
export default function StatsCard({ title, value, change }: StatsCardProps) {
  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 sm:p-6 hover:border-gray-700 transition-colors">
      <div className="text-gray-400 text-xs sm:text-sm mb-2">{title}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-xl sm:text-2xl font-bold text-white truncate">{value}</div>
        {change !== undefined && (
          <div className={`flex items-center text-xs sm:text-sm flex-shrink-0 ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change >= 0 ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />}
            <span className="ml-1">{Math.abs(change)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
