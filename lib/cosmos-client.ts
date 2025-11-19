/**
 * Client-side Cosmos LCD client
 * Fetches directly from LCD endpoints to bypass server IP blocks
 */

export interface LCDEndpoint {
  address: string;
  provider: string;
}

export interface ValidatorResponse {
  validators: any[];
  pagination?: {
    next_key: string | null;
    total?: string;
  };
}

/**
 * Fetch validators directly from LCD endpoint (client-side)
 * Uses browser's fetch API to bypass server IP blocking
 */
export async function fetchValidatorsDirectly(
  endpoints: LCDEndpoint[],
  status: string = 'BOND_STATUS_BONDED',
  limit: number = 300
): Promise<any[]> {
  const errors: string[] = [];
  
  // Try each endpoint until one succeeds
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/staking/v1beta1/validators?status=${status}&pagination.limit=${limit}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
        // Use 'cors' mode to allow cross-origin requests
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        errors.push(`${endpoint.provider}: HTTP ${response.status}`);
        continue;
      }
      
      const data: ValidatorResponse = await response.json();
      
      if (!data.validators || data.validators.length === 0) {
        errors.push(`${endpoint.provider}: Empty response`);
        continue;
      }
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} (${data.validators.length} validators)`);
      return data.validators;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  // All endpoints failed
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch proposals directly from LCD endpoint (client-side)
 */
export async function fetchProposalsDirectly(
  endpoints: LCDEndpoint[],
  status: string = 'PROPOSAL_STATUS_VOTING_PERIOD',
  limit: number = 100
): Promise<any[]> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/gov/v1beta1/proposals?proposal_status=${status}&pagination.limit=${limit}&pagination.reverse=true`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        errors.push(`${endpoint.provider}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      
      if (!data.proposals) {
        errors.push(`${endpoint.provider}: No proposals field`);
        continue;
      }
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} (${data.proposals.length} proposals)`);
      return data.proposals;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch delegators count for a validator
 * Smart fallback: Uses ssl.winsnip.xyz if direct LCD fails
 */
export async function fetchValidatorDelegatorsCount(
  endpoints: LCDEndpoint[],
  validatorAddress: string,
  chainPath?: string
): Promise<number> {
  // Try direct LCD endpoints first
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint.address}/cosmos/staking/v1beta1/validators/${validatorAddress}/delegations?pagination.limit=1&pagination.count_total=true`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const total = data.pagination?.total || '0';
      return parseInt(total);
      
    } catch (error: any) {
      continue;
    }
  }
  
  // Smart fallback: Try ssl.winsnip.xyz API if all LCD endpoints fail
  if (chainPath) {
    try {
      console.log(`[CosmosClient] Direct LCD failed for delegators, trying ssl.winsnip.xyz fallback`);
      const fallbackUrl = `https://ssl.winsnip.xyz/api/validators/delegators?chain=${chainPath}&validator=${validatorAddress}`;
      
      const response = await fetch(fallbackUrl, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[CosmosClient] ✓ Delegators from ssl.winsnip.xyz fallback: ${data.count || 0}`);
        return data.count || 0;
      }
    } catch (fallbackError) {
      console.error('[CosmosClient] Fallback API also failed for delegators:', fallbackError);
    }
  }
  
  return 0; // Return 0 if everything fails
}

/**
 * Check if a chain should use direct LCD fetch (rate limited chains)
 * Enable for ALL chains to bypass server IP blocks universally
 */
export function shouldUseDirectFetch(chainName: string): boolean {
  // Use client-side fetch for ALL chains
  // This bypasses rate limiting and IP blocks universally
  // Server API is kept as fallback for better performance when it works
  return true;
}

/**
 * Fetch blocks directly from LCD endpoint (client-side)
 */
export async function fetchBlocksDirectly(
  endpoints: LCDEndpoint[],
  limit: number = 20
): Promise<any[]> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Fetching blocks from ${endpoint.provider}`);
      
      // Get latest block first to know the height
      const latestUrl = `${endpoint.address}/cosmos/base/tendermint/v1beta1/blocks/latest`;
      const latestResponse = await fetch(latestUrl, {
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      if (!latestResponse.ok) {
        errors.push(`${endpoint.provider}: HTTP ${latestResponse.status}`);
        continue;
      }
      
      const latestData = await latestResponse.json();
      const latestHeight = parseInt(latestData.block?.header?.height || '0');
      
      if (!latestHeight) {
        errors.push(`${endpoint.provider}: No height in response`);
        continue;
      }
      
      // Fetch recent blocks
      const blocks = [];
      for (let i = 0; i < limit; i++) {
        const height = latestHeight - i;
        if (height <= 0) break;
        
        try {
          const blockUrl = `${endpoint.address}/cosmos/base/tendermint/v1beta1/blocks/${height}`;
          const blockResponse = await fetch(blockUrl, {
            headers: { 'Accept': 'application/json' },
            mode: 'cors',
          });
          
          if (blockResponse.ok) {
            const blockData = await blockResponse.json();
            blocks.push(blockData);
          }
        } catch (err) {
          // Skip failed blocks
          continue;
        }
      }
      
      if (blocks.length > 0) {
        console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} (${blocks.length} blocks)`);
        return blocks;
      }
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch single block by height directly from LCD endpoint
 */
export async function fetchBlockByHeightDirectly(
  endpoints: LCDEndpoint[],
  height: string | number
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Fetching block ${height} from ${endpoint.provider}`);
      
      const url = `${endpoint.address}/cosmos/base/tendermint/v1beta1/blocks/${height}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        errors.push(`${endpoint.provider}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider}`);
      return data;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch transactions directly from LCD endpoint
 */
export async function fetchTransactionsDirectly(
  endpoints: LCDEndpoint[],
  page: number = 1,
  limit: number = 20
): Promise<any> {
  const errors: string[] = [];
  const offset = (page - 1) * limit;
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Fetching transactions from ${endpoint.provider}`);
      
      const url = `${endpoint.address}/cosmos/tx/v1beta1/txs?pagination.limit=${limit}&pagination.offset=${offset}&pagination.reverse=true`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        errors.push(`${endpoint.provider}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} (${data.txs?.length || 0} txs)`);
      return data;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch single transaction by hash
 */
export async function fetchTransactionByHashDirectly(
  endpoints: LCDEndpoint[],
  hash: string
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Fetching tx ${hash} from ${endpoint.provider}`);
      
      const url = `${endpoint.address}/cosmos/tx/v1beta1/txs/${hash}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        errors.push(`${endpoint.provider}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider}`);
      return data;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch staking parameters directly
 */
export async function fetchStakingParamsDirectly(
  endpoints: LCDEndpoint[]
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint.address}/cosmos/staking/v1beta1/params`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      if (!response.ok) {
        errors.push(`${endpoint.provider}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`[CosmosClient] ✓ Staking params from ${endpoint.provider}`);
      return data;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch slashing parameters directly
 */
export async function fetchSlashingParamsDirectly(
  endpoints: LCDEndpoint[]
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint.address}/cosmos/slashing/v1beta1/params`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      if (!response.ok) {
        errors.push(`${endpoint.provider}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`[CosmosClient] ✓ Slashing params from ${endpoint.provider}`);
      return data;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch governance parameters directly
 */
export async function fetchGovParamsDirectly(
  endpoints: LCDEndpoint[]
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      // Try to fetch all gov params
      const [voting, deposit, tally] = await Promise.allSettled([
        fetch(`${endpoint.address}/cosmos/gov/v1beta1/params/voting`, {
          headers: { 'Accept': 'application/json' },
          mode: 'cors',
        }).then(r => r.ok ? r.json() : null),
        fetch(`${endpoint.address}/cosmos/gov/v1beta1/params/deposit`, {
          headers: { 'Accept': 'application/json' },
          mode: 'cors',
        }).then(r => r.ok ? r.json() : null),
        fetch(`${endpoint.address}/cosmos/gov/v1beta1/params/tallying`, {
          headers: { 'Accept': 'application/json' },
          mode: 'cors',
        }).then(r => r.ok ? r.json() : null),
      ]);
      
      const result: any = {};
      if (voting.status === 'fulfilled' && voting.value) result.voting_params = voting.value;
      if (deposit.status === 'fulfilled' && deposit.value) result.deposit_params = deposit.value;
      if (tally.status === 'fulfilled' && tally.value) result.tally_params = tally.value;
      
      if (Object.keys(result).length > 0) {
        console.log(`[CosmosClient] ✓ Gov params from ${endpoint.provider}`);
        return result;
      }
      
      errors.push(`${endpoint.provider}: No valid params`);
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch distribution parameters directly
 */
export async function fetchDistributionParamsDirectly(
  endpoints: LCDEndpoint[]
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint.address}/cosmos/distribution/v1beta1/params`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      if (!response.ok) {
        errors.push(`${endpoint.provider}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`[CosmosClient] ✓ Distribution params from ${endpoint.provider}`);
      return data;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch mint parameters directly
 */
export async function fetchMintParamsDirectly(
  endpoints: LCDEndpoint[]
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint.address}/cosmos/mint/v1beta1/params`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      if (!response.ok) {
        errors.push(`${endpoint.provider}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`[CosmosClient] ✓ Mint params from ${endpoint.provider}`);
      return data;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch account details directly
 */
export async function fetchAccountDirectly(
  endpoints: LCDEndpoint[],
  address: string
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Fetching account ${address} from ${endpoint.provider}`);
      
      const url = `${endpoint.address}/cosmos/auth/v1beta1/accounts/${address}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        errors.push(`${endpoint.provider}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider}`);
      return data;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch account balances directly
 */
export async function fetchBalancesDirectly(
  endpoints: LCDEndpoint[],
  address: string
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint.address}/cosmos/bank/v1beta1/balances/${address}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        errors.push(`${endpoint.provider}: HTTP ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`[CosmosClient] ✓ Balances from ${endpoint.provider}`);
      return data;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch validator uptime (signing info)
 * Smart fallback: Uses ssl.winsnip.xyz if direct LCD fails
 */
export async function fetchValidatorUptime(
  endpoints: LCDEndpoint[],
  consensusAddress: string,
  chainPath?: string
): Promise<number> {
  // Try direct LCD endpoints first
  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint.address}/cosmos/slashing/v1beta1/signing_infos/${consensusAddress}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const missedBlocks = parseInt(data.val_signing_info?.missed_blocks_counter || '0');
      const indexOffset = parseInt(data.val_signing_info?.index_offset || '0');
      
      // Calculate uptime: (total - missed) / total * 100
      if (indexOffset > 0) {
        const uptime = ((indexOffset - missedBlocks) / indexOffset) * 100;
        return Math.max(0, Math.min(100, uptime)); // Clamp between 0-100
      }
      
      return 100; // Default to 100% if no data
      
    } catch (error: any) {
      continue;
    }
  }
  
  // Smart fallback: Try ssl.winsnip.xyz API if all LCD endpoints fail
  if (chainPath && consensusAddress) {
    try {
      const fallbackUrl = `https://ssl.winsnip.xyz/api/validators/uptime?chain=${chainPath}&consensus=${consensusAddress}`;
      
      const response = await fetch(fallbackUrl, {
        headers: { 'Accept': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.uptime || 100;
      }
    } catch (fallbackError) {
      // Silent fail
    }
  }
  
  return 100; // Default to 100% if everything fails
}
