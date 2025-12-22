/**
 * Verified Tokens Cache
 * Fetch verified tokens list from backend and cache it
 */

// Minimal fallback list (only if backend completely unavailable)
const FALLBACK_VERIFIED = [
  'paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u', // COBRA
];

let cachedVerifiedTokens: string[] = FALLBACK_VERIFIED;
let lastFetch: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch verified tokens list from backend
 */
async function fetchVerifiedTokens(): Promise<string[]> {
  const backends = [
    'https://ssl.winsnip.xyz',
    'https://ssl2.winsnip.xyz',
  ];

  for (const backend of backends) {
    try {
      const response = await fetch(`${backend}/api/prc20-tokens/verified/list`, {
        signal: AbortSignal.timeout(3000),
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.verified && Array.isArray(data.verified)) {
          console.log(`✅ [Verified] Fetched ${data.verified.length} verified tokens from ${backend}`);
          return data.verified;
        }
      }
    } catch (error) {
      console.warn(`⚠️ [Verified] Failed to fetch from ${backend}:`, error);
    }
  }

  // Return fallback if all backends failed
  console.warn('⚠️ [Verified] Using fallback list');
  return FALLBACK_VERIFIED;
}

/**
 * Get verified tokens with caching
 */
export async function getVerifiedTokens(): Promise<string[]> {
  const now = Date.now();

  // Return cached if still fresh
  if (now - lastFetch < CACHE_DURATION && cachedVerifiedTokens.length > 1) {
    return cachedVerifiedTokens;
  }

  // Fetch fresh data
  try {
    const tokens = await fetchVerifiedTokens();
    cachedVerifiedTokens = tokens;
    lastFetch = now;
    return tokens;
  } catch (error) {
    console.error('❌ [Verified] Error fetching verified tokens:', error);
    return cachedVerifiedTokens;
  }
}

/**
 * Check if token is verified
 */
export async function isTokenVerified(address: string): Promise<boolean> {
  const verified = await getVerifiedTokens();
  return verified.includes(address);
}

/**
 * Force refresh verified tokens list
 */
export async function refreshVerifiedTokens(): Promise<string[]> {
  lastFetch = 0; // Force refresh
  return getVerifiedTokens();
}
