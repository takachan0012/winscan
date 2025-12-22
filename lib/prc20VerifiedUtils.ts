/**
 * PRC20 Token Data Utility
 * Handles fetching and caching of PRC20 token metadata from backend
 * Similar to keybase avatar system for validators
 */

export interface PRC20TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  logo?: string;
  description?: string;
  website?: string;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  coingeckoId?: string;
  tags?: string[];
  updatedAt?: string;
}

/**
 * Fetch token metadata from backend API
 */
export async function fetchTokenMetadata(address: string): Promise<PRC20TokenMetadata | null> {
  try {
    const response = await fetch(`/api/prc20/metadata?address=${address}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch token metadata:', error);
    return null;
  }
}

/**
 * Get cached token metadata from localStorage
 * Cache expires after 24 hours
 */
export function getCachedTokenMetadata(address: string): PRC20TokenMetadata | null {
  try {
    const cacheKey = `prc20_metadata_${address}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    // Cache expires after 24 hours
    if (age > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

/**
 * Cache token metadata in localStorage
 */
export function cacheTokenMetadata(address: string, metadata: PRC20TokenMetadata): void {
  try {
    const cacheKey = `prc20_metadata_${address}`;
    localStorage.setItem(cacheKey, JSON.stringify({
      data: metadata,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Failed to cache token metadata:', error);
  }
}

/**
 * Get token metadata with caching (similar to getValidatorAvatar)
 * 1. Check localStorage cache
 * 2. If not cached or expired, fetch from backend
 * 3. Cache the result
 */
export async function getTokenMetadata(address: string): Promise<PRC20TokenMetadata | null> {
  // Check cache first
  const cached = getCachedTokenMetadata(address);
  if (cached) return cached;
  
  // Fetch from backend
  const metadata = await fetchTokenMetadata(address);
  
  // Cache the result
  if (metadata) {
    cacheTokenMetadata(address, metadata);
  }
  
  return metadata;
}

/**
 * Batch fetch token metadata for multiple addresses
 * Uses localStorage cache to minimize API calls
 */
export async function getBatchTokenMetadata(
  addresses: string[]
): Promise<Record<string, PRC20TokenMetadata | null>> {
  const result: Record<string, PRC20TokenMetadata | null> = {};
  const uncached: string[] = [];
  
  // Check cache for each address
  addresses.forEach(address => {
    const cached = getCachedTokenMetadata(address);
    if (cached) {
      result[address] = cached;
    } else {
      uncached.push(address);
    }
  });
  
  // Fetch uncached addresses from backend
  if (uncached.length > 0) {
    try {
      const response = await fetch('/api/prc20/metadata/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addresses: uncached }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Cache and add to result
        Object.entries(data.tokens || {}).forEach(([address, metadata]) => {
          result[address] = metadata as PRC20TokenMetadata;
          if (metadata) {
            cacheTokenMetadata(address, metadata as PRC20TokenMetadata);
          }
        });
      }
    } catch (error) {
      console.error('Failed to batch fetch token metadata:', error);
      // Set uncached addresses as null
      uncached.forEach(address => {
        result[address] = null;
      });
    }
  }
  
  return result;
}

/**
 * Hardcoded list of verified tokens (fallback when backend is unavailable)
 * @deprecated Use getVerifiedTokens() from verifiedTokensCache.ts instead
 */
export const VERIFIED_TOKENS_FALLBACK: string[] = [
  'paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u', // COBRA - Minimal fallback
];

/**
 * Check if token is verified (with fallback to hardcoded list)
 * @deprecated Use isTokenVerified() from verifiedTokensCache.ts instead
 */
export function isTokenVerified(address: string): boolean {
  return VERIFIED_TOKENS_FALLBACK.includes(address);
}
