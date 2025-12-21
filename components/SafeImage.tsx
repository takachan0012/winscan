'use client';

import Image from 'next/image';
import { useState } from 'react';

interface SafeImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallbackSrc?: string;
  onError?: () => void;
}

/**
 * SafeImage Component - Handle external image errors gracefully
 * Falls back to placeholder if image fails to load
 */
export default function SafeImage({
  src,
  alt,
  width = 48,
  height = 48,
  className = '',
  fallbackSrc,
  onError,
}: SafeImageProps) {
  const [imageSrc, setImageSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      
      // Try fallback first
      if (fallbackSrc && imageSrc !== fallbackSrc) {
        setImageSrc(fallbackSrc);
      } else {
        // Use placeholder
        const placeholder = `https://ui-avatars.com/api/?name=${encodeURIComponent(alt)}&size=${width}&background=random`;
        setImageSrc(placeholder);
      }
      
      onError?.();
    }
  };

  // Skip Image optimization for problematic domains
  const shouldUnoptimize = 
    imageSrc.includes('i.ibb.co') || 
    imageSrc.includes('imgur.com') ||
    imageSrc.includes('postimg.cc');

  if (shouldUnoptimize) {
    return (
      <img
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        className={className}
        onError={handleError}
        loading="lazy"
        style={{ objectFit: 'cover' }}
      />
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={handleError}
      loading="lazy"
      style={{ objectFit: 'cover' }}
    />
  );
}
