const API_URLS = [
  process.env.NEXT_PUBLIC_API_URL || 'https://ssl.winsnip.xyz',
  process.env.NEXT_PUBLIC_API_URL_FALLBACK || 'https://ssl2.winsnip.xyz'
];

let currentUrlIndex = 0;
let failureCount = 0;
const MAX_FAILURES = 3;

// Automatic load balancing - rotate URLs when failures occur
function getNextApiUrl(): string {
  if (failureCount >= MAX_FAILURES) {
    currentUrlIndex = (currentUrlIndex + 1) % API_URLS.length;
    failureCount = 0;
    console.log(`🔄 Switching to API URL: ${API_URLS[currentUrlIndex]}`);
  }
  return API_URLS[currentUrlIndex];
}

export function getApiUrl(endpoint: string): string {
  return endpoint;
}

export async function fetchApi(endpoint: string, options?: RequestInit) {
  const url = getApiUrl(endpoint);
  
  // Try all available URLs with retry logic
  for (let urlIndex = 0; urlIndex < API_URLS.length; urlIndex++) {
    const baseUrl = API_URLS[(currentUrlIndex + urlIndex) % API_URLS.length];
    
    for (let attempt = 0; attempt < 2; attempt++) {
      let timeoutId: NodeJS.Timeout | undefined;
      
      try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
        
        const response = await fetch(url, { 
          ...options,
          signal: controller.signal,
          cache: 'no-store',
          mode: 'cors',
          headers: {
            ...options?.headers,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // Success - reset failure count
        failureCount = 0;
        return response;
        
      } catch (error: any) {
        if (timeoutId) clearTimeout(timeoutId);
        failureCount++;
        
        console.warn(`⚠️ API request failed (attempt ${attempt + 1}/2 on ${baseUrl}):`, error.message);
        
        // If this is not the last attempt or last URL, continue retrying
        if (attempt < 1 || urlIndex < API_URLS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); // Exponential backoff
          continue;
        }
        
        // Last attempt failed
        throw error;
      }
    }
  }
  
  throw new Error('All API endpoints failed');
}
