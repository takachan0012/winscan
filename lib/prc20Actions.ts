/**
 * PRC20 Token Actions
 * Utilities for burning, marketing info, and token management
 */

import { ChainData } from '@/types/chain';

interface MarketingInfo {
  project?: string;
  description?: string;
  logo?: {
    url: string;
  };
  marketing?: string;
}

interface MinterInfo {
  minter: string;
  cap?: string;
}

/**
 * Query PRC20 marketing info from contract
 */
export async function queryMarketingInfo(
  lcdUrl: string,
  contractAddress: string
): Promise<MarketingInfo | null> {
  try {
    const query = { marketing_info: {} };
    const queryBase64 = Buffer.from(JSON.stringify(query)).toString('base64');
    const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${queryBase64}`;

    const response = await fetch(url, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error querying marketing info:', error);
    return null;
  }
}

/**
 * Query PRC20 minter info from contract
 */
export async function queryMinterInfo(
  lcdUrl: string,
  contractAddress: string
): Promise<MinterInfo | null> {
  try {
    const query = { minter: {} };
    const queryBase64 = Buffer.from(JSON.stringify(query)).toString('base64');
    const url = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${queryBase64}`;

    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error querying minter info:', error);
    return null;
  }
}

/**
 * Burn PRC20 tokens
 */
export async function burnPRC20Tokens(
  chain: ChainData,
  contractAddress: string,
  amount: string,
  memo: string = 'Burn tokens'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!window.keplr) {
      throw new Error('Keplr wallet not installed');
    }

    const chainId = chain.chain_id || chain.chain_name;
    await window.keplr.enable(chainId);

    const offlineSigner = await window.keplr.getOfflineSignerAuto(chainId);
    const accounts = await offlineSigner.getAccounts();
    const signerAddress = accounts[0].address;

    // Import required modules
    const { GasPrice } = await import('@cosmjs/stargate');
    const { connectCosmWasmClient } = await import('./cosmosClient');

    // Get RPC endpoint
    const rpcList = chain.rpc || [];
    let rpcEndpoint = '';
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        break;
      }
    }
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
    }

    // Create CosmWasm client with automatic failover
    const client = await connectCosmWasmClient(rpcEndpoint, offlineSigner) as any;
    // Check balance before burning
    const balanceQuery = {
      balance: { address: signerAddress }
    };
    
    try {
      const balanceResult = await client.queryContractSmart(contractAddress, balanceQuery);
      const currentBalance = BigInt(balanceResult.balance);
      const burnAmount = BigInt(amount);

      console.log('💰 Current balance:', currentBalance.toString());
      console.log('🔥 Burn amount:', burnAmount.toString());

      if (currentBalance < burnAmount) {
        throw new Error(`Insufficient balance. You have ${currentBalance.toString()} but trying to burn ${burnAmount.toString()}`);
      }
    } catch (error: any) {
      if (error.message.includes('Insufficient balance')) {
        throw error;
      }
      console.warn('⚠️ Could not verify balance, proceeding with burn...');
    }
    // Burn message
    const burnMsg = {
      burn: {
        amount: amount
      }
    };

    console.log('🔥 Burning tokens:', {
      contract: contractAddress,
      amount: amount,
      signer: signerAddress
    });

    // Execute burn with sufficient gas
    const fee = {
      amount: [{ denom: 'upaxi', amount: '7500' }],
      gas: '300000' // Increased from 200k (actual usage ~219k)
    };

    const result = await client.execute(
      signerAddress,
      contractAddress,
      burnMsg,
      fee,
      memo
    );

    console.log('✅ Burn successful:', result.transactionHash);

    return {
      success: true,
      txHash: result.transactionHash
    };
  } catch (error: any) {
    console.error('❌ Burn failed:', error);
    return {
      success: false,
      error: error.message || 'Burn failed'
    };
  }
}

/**
 * Mint PRC20 tokens (only if you're the minter)
 */
export async function mintPRC20Tokens(
  chain: ChainData,
  contractAddress: string,
  recipient: string,
  amount: string,
  memo: string = 'Mint tokens'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!window.keplr) {
      throw new Error('Keplr wallet not installed');
    }

    const chainId = chain.chain_id || chain.chain_name;
    await window.keplr.enable(chainId);

    const offlineSigner = await window.keplr.getOfflineSignerAuto(chainId);
    const accounts = await offlineSigner.getAccounts();
    const signerAddress = accounts[0].address;

    // Import required modules
    const { GasPrice } = await import('@cosmjs/stargate');
    const { connectCosmWasmClient } = await import('./cosmosClient');

    // Get RPC endpoint with fallback
    const rpcList = chain.rpc || [];
    let rpcEndpoint = '';
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        break;
      }
    }
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
    }
    // Fallback to default Paxi RPC if no RPC found
    if (!rpcEndpoint) {
      rpcEndpoint = 'https://mainnet-rpc.paxinet.io';
    }

    console.log('🔗 Using RPC endpoint:', rpcEndpoint);

    // Create CosmWasm client with automatic failover
    const client = await connectCosmWasmClient(rpcEndpoint, offlineSigner) as any;

    // Mint message
    const mintMsg = {
      mint: {
        recipient: recipient,
        amount: amount
      }
    };

    console.log('⚡ Minting tokens:', {
      contract: contractAddress,
      recipient: recipient,
      amount: amount,
      signer: signerAddress
    });

    // Execute mint with sufficient gas
    const fee = {
      amount: [{ denom: 'upaxi', amount: '7500' }],
      gas: '300000' // Increased for safety
    };

    const result = await client.execute(
      signerAddress,
      contractAddress,
      mintMsg,
      fee,
      memo
    );

    console.log('✅ Mint successful:', result.transactionHash);

    return {
      success: true,
      txHash: result.transactionHash
    };
  } catch (error: any) {
    console.error('❌ Mint failed:', error);
    return {
      success: false,
      error: error.message || 'Mint failed'
    };
  }
}

/**
 * Update marketing info (only if you're the marketing address)
 */
export async function updateMarketingInfo(
  chain: ChainData,
  contractAddress: string,
  marketingInfo: {
    project?: string;
    description?: string;
    marketing?: string;
  },
  memo: string = 'Update marketing info'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!window.keplr) {
      throw new Error('Keplr wallet not installed');
    }

    const chainId = chain.chain_id || chain.chain_name;
    await window.keplr.enable(chainId);

    const offlineSigner = await window.keplr.getOfflineSignerAuto(chainId);
    const accounts = await offlineSigner.getAccounts();
    const signerAddress = accounts[0].address;

    const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate');
    const { GasPrice } = await import('@cosmjs/stargate');

    const rpcList = chain.rpc || [];
    let rpcEndpoint = '';
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        break;
      }
    }
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
    }

    const client = await SigningCosmWasmClient.connectWithSigner(
      rpcEndpoint,
      offlineSigner,
      { gasPrice: GasPrice.fromString('0.025upaxi') }
    );

    const updateMsg = {
      update_marketing: marketingInfo
    };

    console.log('📝 Updating marketing info:', {
      contract: contractAddress,
      info: marketingInfo,
      signer: signerAddress
    });

    const fee = {
      amount: [{ denom: 'upaxi', amount: '7500' }],
      gas: '300000' // Increased for safety
    };

    const result = await client.execute(
      signerAddress,
      contractAddress,
      updateMsg,
      fee,
      memo
    );

    console.log('✅ Marketing info updated:', result.transactionHash);

    return {
      success: true,
      txHash: result.transactionHash
    };
  } catch (error: any) {
    console.error('❌ Update marketing info failed:', error);
    return {
      success: false,
      error: error.message || 'Update failed'
    };
  }
}

/**
 * Transfer PRC20 tokens to another address
 */
export async function transferPRC20Tokens(
  chain: string,
  contractAddress: string,
  recipient: string,
  amount: string,
  memo: string = 'Transfer tokens'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!window.keplr) {
      throw new Error('Keplr wallet not installed');
    }

    await window.keplr.enable(chain);

    const offlineSigner = await window.keplr.getOfflineSignerAuto(chain);
    const accounts = await offlineSigner.getAccounts();
    const signerAddress = accounts[0].address;

    // Import required modules
    const { GasPrice } = await import('@cosmjs/stargate');
    const { connectCosmWasmClient } = await import('./cosmosClient');

    // Use RPC endpoint - for paxi-mainnet
    const rpcEndpoint = 'https://mainnet-rpc.paxinet.io';

    console.log('🔗 Using RPC endpoint:', rpcEndpoint);

    // Create CosmWasm client with automatic failover
    const client = await connectCosmWasmClient(rpcEndpoint, offlineSigner) as any;

    // Transfer message
    const transferMsg = {
      transfer: {
        recipient: recipient,
        amount: amount
      }
    };

    console.log('📤 Transferring tokens:', {
      contract: contractAddress,
      from: signerAddress,
      to: recipient,
      amount: amount
    });

    // Execute transfer with sufficient gas
    const fee = {
      amount: [{ denom: 'upaxi', amount: '7500' }],
      gas: '300000'
    };

    const result = await client.execute(
      signerAddress,
      contractAddress,
      transferMsg,
      fee,
      memo
    );

    console.log('✅ Transfer successful:', result.transactionHash);

    return {
      success: true,
      txHash: result.transactionHash
    };
  } catch (error: any) {
    console.error('❌ Transfer failed:', error);
    return {
      success: false,
      error: error.message || 'Transfer failed'
    };
  }
}
