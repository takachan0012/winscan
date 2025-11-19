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

export interface BlockResponse {
  block: {
    header: {
      height: string;
      time: string;
      proposer_address: string;
    };
    data: {
      txs: string[];
    };
  };
  block_id: {
    hash: string;
  };
}

export interface TxResponse {
  tx_response: any;
}

export interface AccountResponse {
  account: any;
}

/**
 * Fetch validators directly from LCD endpoint (client-side)
 */
export async function fetchValidatorsDirectly(
  endpoints: LCDEndpoint[],
  status: string = 'BOND_STATUS_BONDED',
  limit: number = 300
): Promise<any[]> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/staking/v1beta1/validators?status=${status}&pagination.limit=${limit}`;
      
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
        headers: { 'Accept': 'application/json' },
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
 * Fetch blocks directly from RPC endpoint (client-side)
 */
export async function fetchBlocksDirectly(
  endpoints: LCDEndpoint[],
  minHeight?: number,
  maxHeight?: number,
  limit: number = 20
): Promise<any[]> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      // Get latest block first if no range specified
      let latestHeight: number;
      if (!maxHeight) {
        const latestUrl = `${endpoint.address}/cosmos/base/tendermint/v1beta1/blocks/latest`;
        const latestRes = await fetch(latestUrl, {
          headers: { 'Accept': 'application/json' },
          mode: 'cors',
        });
        
        if (!latestRes.ok) {
          errors.push(`${endpoint.provider}: Failed to get latest block`);
          continue;
        }
        
        const latestData = await latestRes.json();
        latestHeight = parseInt(latestData.block.header.height);
      } else {
        latestHeight = maxHeight;
      }
      
      // Fetch blocks in range
      const blocks = [];
      const startHeight = minHeight || (latestHeight - limit + 1);
      
      for (let height = latestHeight; height >= startHeight && blocks.length < limit; height--) {
        try {
          const blockUrl = `${endpoint.address}/cosmos/base/tendermint/v1beta1/blocks/${height}`;
          const blockRes = await fetch(blockUrl, {
            headers: { 'Accept': 'application/json' },
            mode: 'cors',
          });
          
          if (blockRes.ok) {
            const blockData = await blockRes.json();
            blocks.push(blockData);
          }
        } catch (e) {
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
 * Fetch single block by height directly from LCD
 */
export async function fetchBlockByHeightDirectly(
  endpoints: LCDEndpoint[],
  height: number | string
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} for block ${height}`);
      return data;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch transactions by height directly from LCD
 */
export async function fetchTxsByHeightDirectly(
  endpoints: LCDEndpoint[],
  height: number | string
): Promise<any[]> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/tx/v1beta1/txs?events=tx.height=${height}`;
      
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
      return data.txs || [];
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch transaction by hash directly from LCD
 */
export async function fetchTxByHashDirectly(
  endpoints: LCDEndpoint[],
  hash: string
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} for tx ${hash}`);
      return data.tx_response;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch account by address directly from LCD
 */
export async function fetchAccountDirectly(
  endpoints: LCDEndpoint[],
  address: string
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} for account ${address}`);
      return data.account;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch account balance directly from LCD
 */
export async function fetchBalanceDirectly(
  endpoints: LCDEndpoint[],
  address: string
): Promise<any[]> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} for balance ${address}`);
      return data.balances || [];
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch signing info for uptime tracking
 */
export async function fetchSigningInfoDirectly(
  endpoints: LCDEndpoint[],
  limit: number = 300
): Promise<any[]> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/slashing/v1beta1/signing_infos?pagination.limit=${limit}`;
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} (${data.info?.length || 0} signing infos)`);
      return data.info || [];
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch slashing params
 */
export async function fetchSlashingParamsDirectly(
  endpoints: LCDEndpoint[]
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/slashing/v1beta1/params`;
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} for slashing params`);
      return data.params;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch staking params
 */
export async function fetchStakingParamsDirectly(
  endpoints: LCDEndpoint[]
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/staking/v1beta1/params`;
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} for staking params`);
      return data.params;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch mint params
 */
export async function fetchMintParamsDirectly(
  endpoints: LCDEndpoint[]
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/mint/v1beta1/params`;
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} for mint params`);
      return data.params;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch distribution params
 */
export async function fetchDistributionParamsDirectly(
  endpoints: LCDEndpoint[]
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/distribution/v1beta1/params`;
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} for distribution params`);
      return data.params;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch gov params
 */
export async function fetchGovParamsDirectly(
  endpoints: LCDEndpoint[]
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      // Try multiple gov param endpoints
      const paramTypes = ['voting', 'deposit', 'tallying'];
      const params: any = {};
      
      for (const type of paramTypes) {
        try {
          const url = `${endpoint.address}/cosmos/gov/v1beta1/params/${type}`;
          const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            mode: 'cors',
          });
          
          if (response.ok) {
            const data = await response.json();
            params[type] = data[`${type}_params`] || data;
          }
        } catch (e) {
          // Skip failed param types
        }
      }
      
      if (Object.keys(params).length > 0) {
        console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} for gov params`);
        return params;
      }
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch single validator by address
 */
export async function fetchValidatorByAddressDirectly(
  endpoints: LCDEndpoint[],
  validatorAddress: string
): Promise<any> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/staking/v1beta1/validators/${validatorAddress}`;
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} for validator ${validatorAddress}`);
      return data.validator;
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch validator delegations
 */
export async function fetchValidatorDelegationsDirectly(
  endpoints: LCDEndpoint[],
  validatorAddress: string,
  limit: number = 1000
): Promise<any[]> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/staking/v1beta1/validators/${validatorAddress}/delegations?pagination.limit=${limit}`;
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} (${data.delegation_responses?.length || 0} delegations)`);
      return data.delegation_responses || [];
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch validator unbonding delegations
 */
export async function fetchValidatorUnbondingDelegationsDirectly(
  endpoints: LCDEndpoint[],
  validatorAddress: string,
  limit: number = 1000
): Promise<any[]> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      const url = `${endpoint.address}/cosmos/staking/v1beta1/validators/${validatorAddress}/unbonding_delegations?pagination.limit=${limit}`;
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} (${data.unbonding_responses?.length || 0} unbonding)`);
      return data.unbonding_responses || [];
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
}

/**
 * Fetch transactions by address (for validator self-delegate tracking)
 */
export async function fetchTxsByAddressDirectly(
  endpoints: LCDEndpoint[],
  address: string,
  limit: number = 100
): Promise<any[]> {
  const errors: string[] = [];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`[CosmosClient] Trying ${endpoint.provider}: ${endpoint.address}`);
      
      // Try message.sender filter
      const url = `${endpoint.address}/cosmos/tx/v1beta1/txs?events=message.sender='${address}'&pagination.limit=${limit}&pagination.reverse=true`;
      
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
      
      console.log(`[CosmosClient] ✓ Success from ${endpoint.provider} (${data.txs?.length || 0} txs for ${address})`);
      return data.txs || [];
      
    } catch (error: any) {
      errors.push(`${endpoint.provider}: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All LCD endpoints failed:\n${errors.join('\n')}`);
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
