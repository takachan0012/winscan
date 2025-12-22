/**
 * Batch Request Utilities
 * Helper functions untuk melakukan batch API requests
 */

export interface BatchAssetDetailRequest {
  chain: string;
  denoms: string[];
}

export interface BatchAssetDetailResult {
  denom: string;
  data?: any;
  error?: string;
  status?: number;
}

export interface BatchHoldersRequest {
  chain: string;
  denoms: string[];
}

export interface BatchHoldersResult {
  denom: string;
  count: number;
  success: boolean;
  error?: string;
}

export interface BatchPRC20HoldersRequest {
  contracts: string[];
}

export interface BatchPRC20HoldersResult {
  contract: string;
  count: number;
  success: boolean;
  error?: string;
}

/**
 * Fetch asset details dalam batch
 * @param chain - Chain ID atau chain name
 * @param denoms - Array of denoms to fetch
 * @returns Map of denom -> asset detail data
 */
export async function fetchAssetDetailsBatch(
  chain: string,
  denoms: string[]
): Promise<Map<string, any>> {
  if (denoms.length === 0) {
    return new Map();
  }

  try {
    const response = await fetch('/api/asset-detail-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chain, denoms }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`Batch asset detail failed: ${response.status}`);
    }

    const result = await response.json();
    const dataMap = new Map<string, any>();

    result.results?.forEach((item: BatchAssetDetailResult) => {
      if (item.data && !item.error) {
        dataMap.set(item.denom, item.data);
      }
    });

    return dataMap;
  } catch (error) {
    console.error('fetchAssetDetailsBatch error:', error);
    return new Map();
  }
}

/**
 * Fetch holders count dalam batch untuk regular assets
 * @param chain - Chain ID atau chain name
 * @param denoms - Array of denoms to fetch holders for
 * @returns Map of denom -> holders count
 */
export async function fetchHoldersBatch(
  chain: string,
  denoms: string[]
): Promise<Map<string, number>> {
  if (denoms.length === 0) {
    return new Map();
  }

  try {
    const response = await fetch('/api/holders-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chain, denoms }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`Batch holders failed: ${response.status}`);
    }

    const result = await response.json();
    const countMap = new Map<string, number>();

    result.results?.forEach((item: BatchHoldersResult) => {
      if (item.success) {
        countMap.set(item.denom, item.count);
      }
    });

    return countMap;
  } catch (error) {
    console.error('fetchHoldersBatch error:', error);
    return new Map();
  }
}

/**
 * Fetch PRC20 holders count dalam batch
 * @param contracts - Array of contract addresses
 * @returns Map of contract -> holders count
 */
export async function fetchPRC20HoldersBatch(
  contracts: string[]
): Promise<Map<string, number>> {
  if (contracts.length === 0) {
    return new Map();
  }

  try {
    const response = await fetch('/api/prc20-holders-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contracts }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`Batch PRC20 holders failed: ${response.status}`);
    }

    const result = await response.json();
    const countMap = new Map<string, number>();

    result.results?.forEach((item: BatchPRC20HoldersResult) => {
      if (item.success) {
        countMap.set(item.contract, item.count);
      }
    });

    return countMap;
  } catch (error) {
    console.error('fetchPRC20HoldersBatch error:', error);
    return new Map();
  }
}

/**
 * Split array into chunks for batch processing
 * @param array - Array to split
 * @param size - Chunk size
 * @returns Array of chunks
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Process items dalam batch dengan concurrency limit
 * @param items - Items to process
 * @param batchSize - Number of items to process at once
 * @param processor - Async function to process each item
 * @returns Array of results
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const chunks = chunkArray(items, batchSize);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
  }

  return results;
}
