'use client';
import { useEffect, useState, useRef } from 'react';
import { TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface PRC20HoldersCountProps {
  contractAddress: string;
  chainName: string;
  initialCount?: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export default function PRC20HoldersCount({ 
  contractAddress, 
  chainName,
  initialCount 
}: PRC20HoldersCountProps) {
  const [holdersCount, setHoldersCount] = useState<number | null>(initialCount || null);
  const [loading, setLoading] = useState(!initialCount);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  
  // Load immediately (no lazy loading) for better UX
  useEffect(() => {
    if (initialCount !== undefined) return;
    setIsVisible(true); // Trigger fetch immediately
  }, [initialCount]);
  
  // Fetch holders count with localStorage cache
  useEffect(() => {
    if (!isVisible || initialCount !== undefined) return;
    
    let mounted = true;
    const cacheKey = `prc20_holders_${contractAddress}`;
    
    const fetchHoldersCount = async () => {
      // Check localStorage cache first
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const { count, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            if (age < CACHE_DURATION) {
              // Use cached data
              if (mounted) {
                setHoldersCount(count);
                setLoading(false);
              }
              return;
            }
          }
        } catch (e) {
          localStorage.removeItem(cacheKey);
        }
      }
      
      // Fetch from API if no valid cache
      try {
        const response = await fetch(
          `/api/prc20-holders?contract=${contractAddress}&limit=1`,
          { signal: AbortSignal.timeout(8000) }
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch holders');
        }
        
        const data = await response.json();
        
        if (mounted) {
          const count = data.count || 0;
          setHoldersCount(count);
          setLoading(false);
          
          // Cache the result
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(cacheKey, JSON.stringify({
                count,
                timestamp: Date.now()
              }));
            } catch (e) {
              console.warn('Failed to cache holders count:', e);
            }
          }
        }
      } catch (error) {
        if (mounted) {
          setHoldersCount(null);
          setLoading(false);
        }
      }
    };
    
    fetchHoldersCount();
    
    return () => {
      mounted = false;
    };
  }, [isVisible, contractAddress, initialCount]);
  
  return (
    <div ref={elementRef}>
      <Link
        href={`/${chainName}/assets/${encodeURIComponent(contractAddress)}/holders`}
        className="group/holders inline-flex items-center gap-1 px-2 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-500/20 hover:border-blue-500/40 rounded-lg transition-all hover:scale-105"
      >
        <span className="text-[10px] md:text-sm font-medium text-white group-hover/holders:text-blue-400 transition-colors whitespace-nowrap">
          {loading ? (
            <div className="w-8 h-4 bg-gray-700 rounded animate-pulse" />
          ) : (
            holdersCount !== null ? holdersCount.toLocaleString() : '-'
          )}
        </span>
        <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-gray-500 group-hover/holders:text-blue-400 transition-colors flex-shrink-0" />
      </Link>
    </div>
  );
}
