/**
 * Helper functions for Authz grant transactions
 */

import { ChainData } from '@/types/chain';

interface StakeAuthorization {
  allowList?: {
    address: string[];
  };
  denyList?: {
    address: string[];
  };
  authorizationType: number;
  maxTokens?: {
    denom: string;
    amount: string;
  };
}

interface Grant {
  authorization: {
    typeUrl: string;
    value: Uint8Array;
  };
  expiration: {
    seconds: string;
    nanos: number;
  };
}

/**
 * Encode StakeAuthorization to bytes
 * Using manual encoding since we need proper proto-buf format
 */
export function encodeStakeAuthorization(auth: StakeAuthorization): Uint8Array {
  // Use cosmjs-types to encode StakeAuthorization properly
  try {
    // Dynamically import to avoid heavy bundles in non-client contexts
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { StakeAuthorization: StakeAuthorizationType } = require('cosmjs-types/cosmos/staking/v1beta1/authz');
    const encoded = StakeAuthorizationType.encode(StakeAuthorizationType.fromPartial({
      allowList: auth.allowList ? { address: auth.allowList.address } : undefined,
      denyList: auth.denyList ? { address: auth.denyList.address } : undefined,
      authorizationType: auth.authorizationType,
      maxTokens: auth.maxTokens ? { denom: auth.maxTokens.denom, amount: auth.maxTokens.amount } : undefined,
    })).finish();

    return encoded;
  } catch (err) {
    console.warn('Failed to encode StakeAuthorization using cosmjs-types:', err);
    return new Uint8Array([]);
  }
}

/**
 * Create authz grant transaction via REST API
 */
export async function submitAuthzGrantTx(
  chain: ChainData,
  params: {
    delegatorAddress: string;
    validatorAddress: string;
    grantee: string;
    durationSeconds: number;
    signedTx: string; // Already signed transaction
  }
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const restEndpoint = chain.api?.[0]?.address;
    if (!restEndpoint) {
      throw new Error('No REST endpoint available');
    }

    // Submit signed transaction
    const response = await fetch(`${restEndpoint}/cosmos/tx/v1beta1/txs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_bytes: params.signedTx,
        mode: 'BROADCAST_MODE_BLOCK',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to broadcast: ${error}`);
    }

    const result = await response.json();
    
    if (result.tx_response?.code === 0) {
      return {
        success: true,
        txHash: result.tx_response.txhash,
      };
    } else {
      return {
        success: false,
        error: result.tx_response?.raw_log || 'Transaction failed',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to submit authz grant',
    };
  }
}
