import { SigningCosmWasmClient, CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { SigningStargateClient, StargateClient } from '@cosmjs/stargate';

// RPC endpoints with automatic failover
const RPC_ENDPOINTS = [
  'https://ssl.winsnip.xyz',
  'https://ssl2.winsnip.xyz'
];

let currentRpcIndex = 0;
let rpcFailureCount = 0;
const MAX_RPC_FAILURES = 2;

// Cache for active clients to avoid reconnection overhead
const clientCache = new Map<string, { client: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getNextRpcEndpoint(): string {
  if (rpcFailureCount >= MAX_RPC_FAILURES) {
    currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
    rpcFailureCount = 0;
    console.log(`🔄 Switching to RPC: ${RPC_ENDPOINTS[currentRpcIndex]}`);
  }
  return RPC_ENDPOINTS[currentRpcIndex];
}

function getCachedClient(cacheKey: string): any | null {
  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.client;
  }
  if (cached) {
    clientCache.delete(cacheKey);
  }
  return null;
}

function setCachedClient(cacheKey: string, client: any): void {
  clientCache.set(cacheKey, { client, timestamp: Date.now() });
}

/**
 * Connect to CosmWasm client with automatic failover and retry
 */
export async function connectCosmWasmClient(
  rpcEndpoint: string,
  signer?: any
): Promise<SigningCosmWasmClient | CosmWasmClient> {
  const cacheKey = `cosmwasm_${rpcEndpoint}_${signer ? 'signer' : 'readonly'}`;
  
  // Try cache first
  const cached = getCachedClient(cacheKey);
  if (cached) {
    return cached;
  }

  // Build list of endpoints to try: provided endpoint first, then fallbacks
  const endpointsToTry = [rpcEndpoint];
  
  // Add fallback endpoints if different from provided endpoint
  for (const fallback of RPC_ENDPOINTS) {
    if (!endpointsToTry.includes(fallback)) {
      endpointsToTry.push(fallback);
    }
  }

  // Try all available RPC endpoints
  for (let i = 0; i < endpointsToTry.length; i++) {
    const endpoint = endpointsToTry[i];
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`🔗 Connecting to CosmWasm RPC: ${endpoint} (attempt ${attempt + 1})`);
        
        const { GasPrice } = await import('@cosmjs/stargate');
        
        const client = signer
          ? await SigningCosmWasmClient.connectWithSigner(endpoint, signer, {
              gasPrice: GasPrice.fromString('0.025upaxi')
            })
          : await SigningCosmWasmClient.connect(endpoint);
        
        // Success - reset failure count and cache client
        rpcFailureCount = 0;
        setCachedClient(cacheKey, client);
        console.log(`✅ CosmWasm client connected to ${endpoint}`);
        return client;
        
      } catch (error: any) {
        rpcFailureCount++;
        console.warn(`⚠️ CosmWasm connection failed on ${endpoint}:`, error.message);
        
        if (attempt < 2 || i < endpointsToTry.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      }
    }
  }
  
  throw new Error('Failed to connect to any CosmWasm RPC endpoint');
}

/**
 * Connect to Stargate client with automatic failover and retry
 */
export async function connectStargateClient(
  rpcEndpoint: string,
  signer?: any
): Promise<SigningStargateClient | StargateClient> {
  const cacheKey = `stargate_${rpcEndpoint}_${signer ? 'signer' : 'readonly'}`;
  
  // Try cache first
  const cached = getCachedClient(cacheKey);
  if (cached) {
    return cached;
  }

  // Build list of endpoints to try: provided endpoint first, then fallbacks
  const endpointsToTry = [rpcEndpoint];
  
  // Add fallback endpoints if different from provided endpoint
  for (const fallback of RPC_ENDPOINTS) {
    if (!endpointsToTry.includes(fallback)) {
      endpointsToTry.push(fallback);
    }
  }

  // Try all available RPC endpoints
  for (let i = 0; i < endpointsToTry.length; i++) {
    const endpoint = endpointsToTry[i];
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`🔗 Connecting to Stargate RPC: ${endpoint} (attempt ${attempt + 1})`);
        
        const { GasPrice } = await import('@cosmjs/stargate');
        
        const client = signer
          ? await SigningStargateClient.connectWithSigner(endpoint, signer, {
              gasPrice: GasPrice.fromString('0.025upaxi')
            })
          : await SigningStargateClient.connect(endpoint);
        
        // Success - reset failure count and cache client
        rpcFailureCount = 0;
        setCachedClient(cacheKey, client);
        console.log(`✅ Stargate client connected to ${endpoint}`);
        return client;
        
      } catch (error: any) {
        rpcFailureCount++;
        console.warn(`⚠️ Stargate connection failed on ${endpoint}:`, error.message);
        
        if (attempt < 2 || i < endpointsToTry.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
      }
    }
  }
  
  throw new Error('Failed to connect to any Stargate RPC endpoint');
}

/**
 * Execute query with automatic retry on different endpoints
 */
export async function executeWithRetry<T>(
  queryFn: (rpcEndpoint: string) => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const endpoint = RPC_ENDPOINTS[(currentRpcIndex + i) % RPC_ENDPOINTS.length];
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await queryFn(endpoint);
        rpcFailureCount = 0;
        return result;
      } catch (error: any) {
        rpcFailureCount++;
        console.warn(`⚠️ Query failed on ${endpoint} (attempt ${attempt + 1}):`, error.message);
        
        if (attempt < maxAttempts - 1 || i < RPC_ENDPOINTS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
      }
    }
  }
  
  throw new Error('Query failed on all RPC endpoints');
}

/**
 * Clear client cache (useful for forced reconnection)
 */
export function clearClientCache(): void {
  clientCache.clear();
  console.log('🗑️ Client cache cleared');
}

/**
 * Get current active RPC endpoint
 */
export function getCurrentRpcEndpoint(): string {
  return RPC_ENDPOINTS[currentRpcIndex];
}

/**
 * Get all available RPC endpoints
 */
export function getAllRpcEndpoints(): string[] {
  return [...RPC_ENDPOINTS];
}
