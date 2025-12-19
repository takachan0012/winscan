/**
 * Pool Price Calculator Module
 * Automatically fetches pool data, queries token decimals, and calculates prices in PAXI
 */

interface PoolPrice {
  price: number; // Price in PAXI per 1 token
  decimals: number;
  reserves: {
    paxi: number;
    token: number;
  };
}

interface TokenInfo {
  decimals: number;
  name?: string;
  symbol?: string;
}

const LCD_ENDPOINTS = [
  'https://mainnet-lcd.paxinet.io',
  'https://api-paxi.winnode.xyz',
  'https://api-paxi-m.maouam.xyz'
];

// Cache for token decimals (1 hour)
const decimalsCache = new Map<string, { decimals: number; timestamp: number }>();
const DECIMALS_CACHE_TTL = 3600000; // 1 hour

/**
 * Query token_info from contract to get correct decimals
 */
async function queryTokenDecimals(tokenAddress: string): Promise<number> {
  // Check cache first
  const cached = decimalsCache.get(tokenAddress);
  if (cached && Date.now() - cached.timestamp < DECIMALS_CACHE_TTL) {
    return cached.decimals;
  }

  const query = Buffer.from(JSON.stringify({ token_info: {} })).toString('base64');
  
  // Try only first endpoint to avoid rate limiting
  try {
    const response = await fetch(
      `${LCD_ENDPOINTS[0]}/cosmwasm/wasm/v1/contract/${tokenAddress}/smart/${query}`,
      { signal: AbortSignal.timeout(2000) }
    );
    
    if (response.ok) {
      const data = await response.json();
      const decimals = parseInt(data.data?.decimals);
      
      if (!isNaN(decimals)) {
        // Cache the result
        decimalsCache.set(tokenAddress, { decimals, timestamp: Date.now() });
        return decimals;
      }
    }
  } catch (e) {
    // Fallback to default
  }
  
  // Default fallback - assume 6 decimals for most tokens
  const defaultDecimals = 6;
  decimalsCache.set(tokenAddress, { decimals: defaultDecimals, timestamp: Date.now() });
  return defaultDecimals;
}

/**
 * Query pool data and calculate price in PAXI
 */
export async function getPoolPrice(tokenAddress: string): Promise<PoolPrice | null> {
  try {
    // Step 1: Query pool data FIRST (faster, no contract call)
    let poolData: any = null;
    
    try {
      const response = await fetch(
        `${LCD_ENDPOINTS[0]}/paxi/swap/pool/${tokenAddress}`,
        { signal: AbortSignal.timeout(3000) }
      );
      
      if (response.ok) {
        const data = await response.json();
        poolData = data.pool || data;
      }
    } catch (e) {
      // Failed to get pool
    }
    
    if (!poolData || !poolData.reserve_paxi || !poolData.reserve_prc20) {
      return null;
    }
    
    // Step 2: Infer decimals from LCD price calculation
    // LCD returns price_paxi_per_prc20 which is calculated with correct decimals
    let tokenDecimals = 6; // Default for most tokens
    
    if (poolData.price_paxi_per_prc20) {
      const paxiReserve = Number(poolData.reserve_paxi) / 1e6;
      const lcdPrice = Number(poolData.price_paxi_per_prc20);
      
      // Try common decimals in order: 6, 18, 8, 9
      // Most tokens use 6 or 18
      const commonDecimals = [6, 18, 8, 9, 12];
      let bestMatch = { decimals: 6, error: Infinity };
      
      for (const testDecimals of commonDecimals) {
        const tokenReserve = Number(poolData.reserve_prc20) / Math.pow(10, testDecimals);
        const calculatedPrice = paxiReserve / tokenReserve;
        const error = Math.abs(calculatedPrice - lcdPrice) / lcdPrice;
        
        if (error < bestMatch.error) {
          bestMatch = { decimals: testDecimals, error };
        }
        
        // If within 0.1% of LCD price, use this decimals
        if (error < 0.001) {
          tokenDecimals = testDecimals;
          break;
        }
      }
      
      // If no perfect match found, use best match
      if (bestMatch.error < 0.05) { // Within 5%
        tokenDecimals = bestMatch.decimals;
      }
    }
    
    // Step 3: Calculate price with inferred decimals
    const paxiReserveRaw = poolData.reserve_paxi;
    const tokenReserveRaw = poolData.reserve_prc20;
    
    // Convert to human-readable amounts
    const paxiReserve = Number(paxiReserveRaw) / 1e6; // PAXI has 6 decimals
    const tokenReserve = Number(tokenReserveRaw) / Math.pow(10, tokenDecimals);
    
    if (tokenReserve <= 0 || paxiReserve <= 0) {
      console.warn(`⚠️ Invalid reserves for ${tokenAddress}`);
      return null;
    }
    
    // Price = PAXI per 1 token
    const price = paxiReserve / tokenReserve;
    
    console.log(`💰 Pool ${tokenAddress.slice(0, 10)}:`);
    console.log(`   Decimals: ${tokenDecimals}`);
    console.log(`   Reserves: ${paxiReserve.toFixed(2)} PAXI | ${tokenReserve.toFixed(2)} tokens`);
    console.log(`   Price: 1 token = ${price.toFixed(10)} PAXI`);
    
    return {
      price,
      decimals: tokenDecimals,
      reserves: {
        paxi: paxiReserve,
        token: tokenReserve
      }
    };
    
  } catch (error) {
    console.error(`❌ Error calculating pool price for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Calculate swap output amount
 */
export function calculateSwapOutput(
  inputAmount: number,
  fromTokenAddress: string,
  toTokenAddress: string,
  priceInPaxi: number
): number {
  // PAXI → Token
  if (fromTokenAddress === 'upaxi') {
    // Input PAXI, divide by token price to get token amount
    return inputAmount / priceInPaxi;
  }
  // Token → PAXI
  else if (toTokenAddress === 'upaxi') {
    // Input Token, multiply by token price to get PAXI amount
    return inputAmount * priceInPaxi;
  }
  
  return 0;
}

/**
 * Get all pool prices in batch
 */
export async function getAllPoolPrices(tokenAddresses: string[]): Promise<Record<string, PoolPrice>> {
  const prices: Record<string, PoolPrice> = {};
  
  // Query in parallel with limit
  const batchSize = 10;
  for (let i = 0; i < tokenAddresses.length; i += batchSize) {
    const batch = tokenAddresses.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(address => getPoolPrice(address))
    );
    
    batch.forEach((address, index) => {
      if (results[index]) {
        prices[address] = results[index]!;
      }
    });
  }
  
  return prices;
}

/**
 * Clear decimals cache
 */
export function clearDecimalsCache() {
  decimalsCache.clear();
}
