'use client';
import { useEffect, useState } from 'react';
import { getValidatorAvatar } from '@/lib/keybaseUtils';
import { Users } from 'lucide-react';
interface ValidatorAvatarProps {
  identity?: string;
  moniker?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showMoniker?: boolean;
}
const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-24 h-24 text-xl',
  '2xl': 'w-32 h-32 text-4xl',
};
export default function ValidatorAvatar({ 
  identity, 
  moniker = 'Unknown Validator',
  size = 'md',
  showMoniker = false 
}: ValidatorAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!identity) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const loadAvatar = async () => {
      try {
        const url = await getValidatorAvatar(identity);
        if (mounted) {
          setAvatarUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load avatar:', err);
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    };
    loadAvatar();
    return () => {
      mounted = false;
    };
  }, [identity]);
  const getInitials = (name?: string) => {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return 'V';
    }
    const trimmedName = name.trim();
    const words = trimmedName.split(' ');
    if (words.length >= 2) {
      const first = words[0][0] || '';
      const second = words[1][0] || '';
      return (first + second).toUpperCase() || 'V';
    }
    return trimmedName.slice(0, 2).toUpperCase() || 'V';
  };
  const renderAvatar = () => {
    const sizeClass = sizeClasses[size];
    if (loading && identity) {
      return (
        <div className={`${sizeClass} rounded-full bg-gray-700 animate-pulse`} />
      );
    }
    if (avatarUrl && !error) {
      return (
        <img
          src={avatarUrl}
          alt={moniker || 'Validator'}
          className={`${sizeClass} rounded-full object-cover border-2 border-primary`}
          onError={() => setError(true)}
        />
      );
    }
    return (
      <div 
        className={`${sizeClass} rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center font-bold text-white`}
      >
        {getInitials(moniker)}
      </div>
    );
  };
  if (showMoniker) {
    return (
      <div className="flex items-center gap-3">
        {renderAvatar()}
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{moniker || 'Unknown Validator'}</span>
          {identity && (
            <span className="text-xs text-text-dim">
              {identity.slice(0, 8)}...{identity.slice(-8)}
            </span>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="relative group">
      {renderAvatar()}
      {}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
        {moniker}
      </div>
    </div>
  );
}
