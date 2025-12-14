'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getActiveAds, trackAdImpression, trackAdClick, type AdConfig } from '@/lib/adsConfig';

interface AdBannerProps {
  position: 'top' | 'sidebar' | 'between-content' | 'bottom';
  className?: string;
}

export default function AdBanner({ position, className = '' }: AdBannerProps) {
  const [ad, setAd] = useState<AdConfig | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isClosable, setIsClosable] = useState(false);

  useEffect(() => {
    // Load ad based on position
    const ads = getActiveAds(position);
    if (ads.length > 0) {
      // Randomly select an ad
      const randomAd = ads[Math.floor(Math.random() * ads.length)];
      setAd(randomAd);
      
      // Track impression
      trackAdImpression(randomAd.id);
    }

    // Top and between-content ads are closable
    setIsClosable(position === 'top' || position === 'between-content');
  }, [position]);

  const handleClick = () => {
    if (ad) {
      // Track ad click
      trackAdClick(ad.id, ad.link);
      window.open(ad.link, ad.link.startsWith('http') ? '_blank' : '_self');
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    // Store in localStorage to remember user closed it
    if (ad) {
      localStorage.setItem(`ad-closed-${ad.id}`, 'true');
    }
  };

  if (!ad || !isVisible) return null;

  // Different styles based on position
  const positionStyles = {
    top: 'w-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-blue-500/20',
    sidebar: 'w-full bg-[#1a1a1a] border border-gray-800 rounded-lg',
    'between-content': 'w-full bg-[#1a1a1a] border border-gray-800 rounded-lg',
    bottom: 'w-full bg-gradient-to-r from-gray-800 to-gray-900 border-t border-gray-700',
  };

  return (
    <div className={`${positionStyles[position]} ${className} relative overflow-hidden`}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {ad.image && (
              <div className="flex-shrink-0 w-12 h-12 bg-gray-700 rounded-lg overflow-hidden">
                <img src={ad.image} alt={ad.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Sponsored</span>
              </div>
              <h4 className="text-sm font-semibold text-white truncate">{ad.title}</h4>
              <p className="text-xs text-gray-400 truncate">{ad.description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {ad.cta && (
              <button
                onClick={handleClick}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {ad.cta}
              </button>
            )}
            {isClosable && (
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors text-gray-500 hover:text-gray-300"
                title="Close ad"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
