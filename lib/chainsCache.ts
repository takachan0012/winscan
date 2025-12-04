
const CACHE_KEY = 'chains_data_v3';
const CACHE_VERSION_KEY = 'chains_version_v3';
const CACHE_TTL = 30 * 1000; // Reduced to 30 seconds

export function getCachedChains() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    const version = sessionStorage.getItem(CACHE_VERSION_KEY);
    
    if (!cached || !version) return null;
    
    const data = JSON.parse(cached);
    const versionData = JSON.parse(version);

    if (Date.now() - versionData.timestamp > CACHE_TTL) {
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

export function setCachedChains(chains: any[], count?: number) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(chains));
    sessionStorage.setItem(CACHE_VERSION_KEY, JSON.stringify({
      timestamp: Date.now(),
      count: count || chains.length
    }));
  } catch {

  }
}

export function clearChainsCache() {
  try {
    // Clear all versions of chains cache
    sessionStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(CACHE_VERSION_KEY);
    sessionStorage.removeItem('chains');
    sessionStorage.removeItem('chains_data');
    sessionStorage.removeItem('chains_version');
    sessionStorage.removeItem('chains_data_v1');
    sessionStorage.removeItem('chains_version_v1');
    sessionStorage.removeItem('chains_data_v2');
    sessionStorage.removeItem('chains_version_v2');
    
    // Clear localStorage as well
    localStorage.removeItem('chains_data_v3');
    localStorage.removeItem('chains_version_v3');
    localStorage.removeItem('chains_data_v2');
    localStorage.removeItem('chains_version_v2');
  } catch {
    // Ignore errors
  }
}

export async function fetchChainsWithCache() {

  if (typeof window !== 'undefined' && sessionStorage.getItem('chains')) {
    clearChainsCache();
  }
  
  try {

    const headResponse = await fetch('/api/chains', { 
      method: 'HEAD',
      cache: 'no-cache'
    });
    
    const serverCount = parseInt(headResponse.headers.get('X-Chains-Count') || '0');

    const cached = getCachedChains();
    if (cached) {
      try {
        const versionData = JSON.parse(sessionStorage.getItem(CACHE_VERSION_KEY) || '{}');

        if (versionData.count === serverCount && Date.now() - versionData.timestamp < CACHE_TTL) {
          return cached;
        }
      } catch {

      }
    }

    const fullResponse = await fetch('/api/chains', { cache: 'no-cache' });
    const chains = await fullResponse.json();

    setCachedChains(chains, serverCount);
    
    return chains;
  } catch (error) {

    const cached = getCachedChains();
    if (cached) return cached;

    const response = await fetch('/api/chains');
    return response.json();
  }
}
