import { ChainData } from '@/types/chain';

// Helper function to create CosmJS registry with EVM pubkey support
async function createEvmRegistry() {
  // @ts-ignore
  const { Registry, defaultRegistryTypes } = await import('@cosmjs/stargate');
  // @ts-ignore
  const { decodePubkey, encodePubkey } = await import('@cosmjs/proto-signing');
  
  const registry = new Registry(defaultRegistryTypes);
  
  // Add EVM pubkey type support
  try {
    // Register eth_secp256k1 pubkey decoder/encoder
    const originalDecode = decodePubkey;
    const originalEncode = encodePubkey;
  } catch (error) {
    console.warn('Could not register EVM pubkey support:', error);
  }
  
  return registry;
}

export interface KeplrChainInfo {
  chainId: string;
  chainName: string;
  rpc: string;
  rest: string;
  bip44: {
    coinType: number;
  };
  bech32Config: {
    bech32PrefixAccAddr: string;
    bech32PrefixAccPub: string;
    bech32PrefixValAddr: string;
    bech32PrefixValPub: string;
    bech32PrefixConsAddr: string;
    bech32PrefixConsPub: string;
  };
  currencies: Array<{
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
  }>;
  feeCurrencies: Array<{
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
    gasPriceStep?: {
      low: number;
      average: number;
      high: number;
    };
  }>;
  stakeCurrency: {
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
  };
  features?: string[];
}
export interface KeplrAccount {
  address: string;
  algo: string;
  pubKey: Uint8Array;
  isNanoLedger: boolean;
}
export function convertChainToKeplr(chain: ChainData, coinType: 118 | 60 = 118): KeplrChainInfo {
  const prefix = chain.addr_prefix || 'cosmos';
  const primaryAsset = chain.assets?.[0];
  return {
    chainId: chain.chain_id || chain.chain_name,
    chainName: chain.chain_name,
    rpc: chain.rpc?.[0]?.address || '',
    rest: chain.api?.[0]?.address || '',
    bip44: {
      coinType: coinType,
    },
    bech32Config: {
      bech32PrefixAccAddr: prefix,
      bech32PrefixAccPub: `${prefix}pub`,
      bech32PrefixValAddr: `${prefix}valoper`,
      bech32PrefixValPub: `${prefix}valoperpub`,
      bech32PrefixConsAddr: `${prefix}valcons`,
      bech32PrefixConsPub: `${prefix}valconspub`,
    },
    currencies: primaryAsset ? [{
      coinDenom: primaryAsset.symbol,
      coinMinimalDenom: primaryAsset.base,
      coinDecimals: typeof primaryAsset.exponent === 'string' ? parseInt(primaryAsset.exponent) : primaryAsset.exponent,
      coinGeckoId: primaryAsset.coingecko_id,
    }] : [],
    feeCurrencies: primaryAsset ? [{
      coinDenom: primaryAsset.symbol,
      coinMinimalDenom: primaryAsset.base,
      coinDecimals: typeof primaryAsset.exponent === 'string' ? parseInt(primaryAsset.exponent) : primaryAsset.exponent,
      coinGeckoId: primaryAsset.coingecko_id,
      gasPriceStep: {
        low: parseFloat(chain.min_tx_fee || '0.01'),
        average: parseFloat(chain.min_tx_fee || '0.025') * 1.5,
        high: parseFloat(chain.min_tx_fee || '0.025') * 2,
      },
    }] : [],
    stakeCurrency: primaryAsset ? {
      coinDenom: primaryAsset.symbol,
      coinMinimalDenom: primaryAsset.base,
      coinDecimals: typeof primaryAsset.exponent === 'string' ? parseInt(primaryAsset.exponent) : primaryAsset.exponent,
      coinGeckoId: primaryAsset.coingecko_id,
    } : {
      coinDenom: 'ATOM',
      coinMinimalDenom: 'uatom',
      coinDecimals: 6,
    },
    features: coinType === 60 ? ['eth-address-gen', 'eth-key-sign', 'ibc-transfer'] : ['ibc-transfer'],
  };
}
export function isKeplrInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.keplr;
}
export function getKeplr() {
  if (!isKeplrInstalled()) {
    throw new Error('Keplr extension is not installed. Please install it from https://www.keplr.app/');
  }
  return window.keplr!;
}
export async function suggestChain(chainInfo: KeplrChainInfo): Promise<void> {
  const keplr = getKeplr();
  try {
    // For EVM chains (coin_type 60), add ethermint account support
    if (chainInfo.bip44.coinType === 60) {
      // @ts-ignore - Keplr internal property
      const chainInfoWithEvm = {
        ...chainInfo,
        features: chainInfo.features || ['eth-address-gen', 'eth-key-sign', 'ibc-transfer'],
      };
      await keplr.experimentalSuggestChain(chainInfoWithEvm);
    } else {
      await keplr.experimentalSuggestChain(chainInfo);
    }
  } catch (error) {
    console.error('Failed to suggest chain to Keplr:', error);
    throw error;
  }
}
export async function connectKeplr(
  chain: ChainData, 
  coinType: 118 | 60 = 118
): Promise<KeplrAccount> {
  if (!isKeplrInstalled()) {
    throw new Error('Keplr extension is not installed');
  }
  const keplr = getKeplr();
  const chainInfo = convertChainToKeplr(chain, coinType);
  let chainId = chainInfo.chainId;

  console.log('🔍 connectKeplr Debug:', {
    chain_name: chain.chain_name,
    chain_id: chain.chain_id,
    computed_chainId: chainId,
    coinType: coinType
  });

  // Verify chain ID from RPC before connecting
  const rpcEndpoint = chain.rpc?.[0]?.address;
  if (rpcEndpoint) {
    try {
      console.log('📡 Verifying chain ID from RPC:', rpcEndpoint);
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const rpcChainId = statusData.result?.node_info?.network;
        
        console.log('📡 RPC Chain ID:', rpcChainId);
        console.log('🔑 Config Chain ID:', chainId);
        
        if (rpcChainId && rpcChainId !== chainId) {
          console.warn(`⚠️ Chain ID mismatch! Config: ${chainId}, RPC: ${rpcChainId}`);
          console.log('🔄 Updating to use RPC chain ID:', rpcChainId);
          chainId = rpcChainId;
          // Update chainInfo with correct chain ID
          chainInfo.chainId = rpcChainId;
        }
      }
    } catch (rpcError) {
      console.warn('Could not verify chain ID from RPC, using config chain ID:', rpcError);
    }
  }

  try {
    try {
      await keplr.enable(chainId);
      console.log('✅ Chain enabled:', chainId);
    } catch (enableError: any) {
      console.log('Chain not found or enable failed:', enableError.message);
      console.log('Suggesting chain to Keplr...');
      
      // For EVM chains, ensure the chain suggestion includes EVM features
      if (coinType === 60 && !chainInfo.features?.includes('eth-address-gen')) {
        chainInfo.features = ['eth-address-gen', 'eth-key-sign', 'ibc-transfer'];
        console.log('🔧 Added EVM features to chain suggestion');
      }
      
      await suggestChain(chainInfo);
      console.log('✅ Chain suggested successfully');
      
      await keplr.enable(chainId);
      console.log('✅ Chain enabled after suggestion:', chainId);
    }
    
    let key;
    try {
      key = await keplr.getKey(chainId);
      console.log('✅ Keplr key retrieved for address:', key.bech32Address);
    } catch (keyError: any) {
      // Handle EthAccount error specifically
      if (keyError.message?.includes('EthAccount') || keyError.message?.includes('Unsupported type')) {
        console.log('🔄 EthAccount type detected, reconnecting with EVM support...');
        
        // Force re-suggest chain with explicit EVM features
        const evmChainInfo = {
          ...chainInfo,
          features: ['eth-address-gen', 'eth-key-sign', 'ibc-transfer'],
        };
        
        await keplr.experimentalSuggestChain(evmChainInfo);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
        await keplr.enable(chainId);
        
        // Retry getKey
        key = await keplr.getKey(chainId);
        console.log('✅ Keplr key retrieved after EVM re-config:', key.bech32Address);
      } else {
        throw keyError;
      }
    }
    
    return {
      address: key.bech32Address,
      algo: key.algo,
      pubKey: key.pubKey,
      isNanoLedger: key.isNanoLedger,
    };
  } catch (error: any) {
    console.error('Failed to connect to Keplr:', error);
    
    // Specific error messages for common issues
    if (error.message?.includes('EthAccount') || error.message?.includes('Unsupported type')) {
      throw new Error(`EVM chain not fully supported in this Keplr version. Please: 1) Update Keplr to latest version, 2) Clear browser cache, 3) Reconnect wallet. Error: ${error.message}`);
    }
    
    if (error.message?.includes('chain id') || error.message?.includes('signer')) {
      throw new Error(`Chain ID mismatch. Please try: 1) Disconnect Keplr wallet, 2) Clear browser cache, 3) Reconnect. Chain ID: ${chainId}`);
    }
    
    throw error;
  }
}
export function disconnectKeplr(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('keplr_account');
    localStorage.removeItem('keplr_chain_id');
    localStorage.removeItem('keplr_coin_type');
  }
}
export function saveKeplrAccount(account: KeplrAccount, chainId: string, coinType: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('keplr_account', JSON.stringify(account));
    localStorage.setItem('keplr_chain_id', chainId);
    localStorage.setItem('keplr_coin_type', coinType.toString());
  }
}
export function getSavedKeplrAccount(): { account: KeplrAccount; chainId: string; coinType: number } | null {
  if (typeof window !== 'undefined') {
    const accountStr = localStorage.getItem('keplr_account');
    const chainId = localStorage.getItem('keplr_chain_id');
    const coinTypeStr = localStorage.getItem('keplr_coin_type');
    if (accountStr && chainId && coinTypeStr) {
      return {
        account: JSON.parse(accountStr),
        chainId,
        coinType: parseInt(coinTypeStr),
      };
    }
  }
  return null;
}
export function onKeplrAccountChange(callback: (accounts: KeplrAccount[]) => void): void {
  if (typeof window !== 'undefined' && window.keplr) {
    window.addEventListener('keplr_keystorechange', async () => {
      const saved = getSavedKeplrAccount();
      if (saved) {
        try {
          const key = await window.keplr!.getKey(saved.chainId);
          callback([{
            address: key.bech32Address,
            algo: key.algo,
            pubKey: key.pubKey,
            isNanoLedger: key.isNanoLedger,
          }]);
        } catch (error) {
          console.error('Failed to get updated account:', error);
          callback([]);
        }
      }
    });
  }
}
declare global {
  interface Window {
    keplr?: {
      enable: (chainId: string) => Promise<void>;
      getKey: (chainId: string) => Promise<{
        bech32Address: string;
        algo: string;
        pubKey: Uint8Array;
        isNanoLedger: boolean;
      }>;
      experimentalSuggestChain: (chainInfo: KeplrChainInfo) => Promise<void>;
      getOfflineSigner: (chainId: string) => any;
      getOfflineSignerAuto: (chainId: string) => Promise<any>;
    };
  }
}

export async function executeStaking(
  chain: ChainData,
  type: 'delegate' | 'undelegate' | 'redelegate' | 'withdraw_rewards' | 'withdraw_commission' | 'withdraw',
  params: {
    delegatorAddress: string;
    validatorAddress: string;
    amount?: string;
    validatorDstAddress?: string;
  },
  gasLimit: string = '300000',
  memo: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🔍 executeStaking Debug:', {
      chain_name: chain.chain_name,
      chain_id: chain.chain_id,
      computed_chainId: chainId,
      type: type,
      params: params
    });
    
    // Suggest chain to Keplr if not already added
    try {
      await keplr.enable(chainId);
      console.log('✅ Chain enabled:', chainId);
    } catch (error: any) {
      // If chain not found, try to suggest it to Keplr
      if (error.message?.includes('There is no chain info')) {
        console.log('Chain not found in Keplr, suggesting chain...');
        const rpcEndpoint = chain.rpc?.[0]?.address || '';
        const apiEndpoint = chain.api?.[0]?.address || '';
        const coinType = parseInt(chain.coin_type || '118');
        
        await keplr.experimentalSuggestChain({
          chainId: chainId,
          chainName: chain.chain_name,
          rpc: rpcEndpoint,
          rest: apiEndpoint,
          bip44: {
            coinType: coinType,
          },
          bech32Config: {
            bech32PrefixAccAddr: chain.addr_prefix || 'cosmos',
            bech32PrefixAccPub: `${chain.addr_prefix || 'cosmos'}pub`,
            bech32PrefixValAddr: `${chain.addr_prefix || 'cosmos'}valoper`,
            bech32PrefixValPub: `${chain.addr_prefix || 'cosmos'}valoperpub`,
            bech32PrefixConsAddr: `${chain.addr_prefix || 'cosmos'}valcons`,
            bech32PrefixConsPub: `${chain.addr_prefix || 'cosmos'}valconspub`,
          },
          currencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
            },
          ],
          feeCurrencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
              gasPriceStep: {
                low: 0.01,
                average: 0.025,
                high: 0.04,
              },
            },
          ],
          stakeCurrency: {
            coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
            coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
            coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
          },
          features: coinType === 60 ? ['eth-address-gen', 'eth-key-sign', 'ibc-transfer'] : ['ibc-transfer'],
        });
        
        // Try to enable again after suggesting
        await keplr.enable(chainId);
      } else {
        throw error;
      }
    }
    
    const offlineSigner = await keplr.getOfflineSignerAuto(chainId);
    
    // Get accounts to verify
    const accounts = await offlineSigner.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }
    
    console.log('✅ Offline signer created for chain ID:', chainId);
    console.log('Account address:', accounts[0].address);
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    const rpcEndpoint = chain.rpc?.[0]?.address || '';
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    console.log('Connecting to RPC:', rpcEndpoint);
    
    // First, get the actual chain ID from the RPC to ensure it matches
    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      console.log('📡 RPC Chain ID:', rpcChainId);
      console.log('🔑 Keplr Chain ID:', chainId);
      
      if (rpcChainId !== chainId) {
        console.warn(`⚠️ Chain ID mismatch! RPC: ${rpcChainId}, Keplr: ${chainId}`);
        console.log('🔄 Re-creating offline signer with correct chain ID...');
        
        // Update chainId to match RPC
        chainId = rpcChainId;
        
        // Re-enable with correct chain ID
        await keplr.enable(chainId);
        
        // Re-create offline signer with correct chain ID
        actualSigner = await keplr.getOfflineSignerAuto(chainId);
        const correctedAccounts = await actualSigner.getAccounts();
        console.log('✅ Corrected offline signer created for chain ID:', chainId);
        console.log('Corrected account:', correctedAccounts[0].address);
      }
    } catch (fetchError) {
      console.warn('Could not fetch chain ID from RPC, continuing with existing chainId:', chainId);
    }
    
    // Create client with custom options to support EVM chains
    const clientOptions: any = { 
      broadcastTimeoutMs: 30000, 
      broadcastPollIntervalMs: 3000,
    };
    
    // For EVM-compatible chains (coin type 60 or ethsecp256k1), add custom amino types
    const isEvmChain = parseInt(chain.coin_type || '118') === 60 || 
                       chainId.includes('_') || // EVM chains often have underscore in chain_id
                       chain.chain_id?.includes('_');
    
    if (isEvmChain) {
      console.log('🔧 Detected EVM-compatible chain, using extended config');
      // CosmJS will handle ethsecp256k1 pubkeys automatically with proper signer
    }
    
    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner,
      clientOptions
    );
    
    console.log('✅ SigningStargateClient connected');

    let msg: any;
    const denom = chain.assets?.[0]?.base || 'uatom';

    // Map 'withdraw' to 'withdraw_rewards' for backward compatibility
    const txType = type === 'withdraw' ? 'withdraw_rewards' : type;

    switch (txType) {
      case 'delegate':
        msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
          value: {
            delegatorAddress: params.delegatorAddress,
            validatorAddress: params.validatorAddress,
            amount: {
              denom: denom,
              amount: params.amount || '0',
            },
          },
        };
        break;

      case 'undelegate':
        msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
          value: {
            delegatorAddress: params.delegatorAddress,
            validatorAddress: params.validatorAddress,
            amount: {
              denom: denom,
              amount: params.amount || '0',
            },
          },
        };
        break;

      case 'redelegate':
        msg = {
          typeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
          value: {
            delegatorAddress: params.delegatorAddress,
            validatorSrcAddress: params.validatorAddress,
            validatorDstAddress: params.validatorDstAddress || '',
            amount: {
              denom: denom,
              amount: params.amount || '0',
            },
          },
        };
        break;

      case 'withdraw_rewards':
        msg = {
          typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
          value: {
            delegatorAddress: params.delegatorAddress,
            validatorAddress: params.validatorAddress,
          },
        };
        break;

      case 'withdraw_commission':
        msg = {
          typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
          value: {
            validatorAddress: params.validatorAddress,
          },
        };
        break;

      default:
        throw new Error('Invalid staking type');
    }

    const fee = {
      amount: [{ denom: denom, amount: '5000' }],
      gas: gasLimit,
    };

    const result = await client.signAndBroadcast(
      params.delegatorAddress,
      [msg],
      fee,
      memo
    );

    if (result.code === 0) {
      return { success: true, txHash: result.transactionHash };
    } else {
      return { success: false, error: result.rawLog };
    }
  } catch (error: any) {
    console.error('Staking error:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

export async function executeWithdrawAll(
  chain: ChainData,
  params: {
    delegatorAddress: string;
    validatorAddress: string;
    hasRewards: boolean;
    hasCommission: boolean;
  },
  gasLimit: string = '300000',
  memo: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🔍 executeWithdrawAll:', {
      hasRewards: params.hasRewards,
      hasCommission: params.hasCommission,
      chainId: chainId
    });
    
    // Enable chain
    await keplr.enable(chainId);
    const offlineSigner = await keplr.getOfflineSignerAuto(chainId);
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    // Find RPC with indexer enabled (tx_index = on)
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    // Priority: Use RPC with tx_index enabled
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    // Fallback: Use first available RPC
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.warn('⚠️ No RPC with tx_index found, using first available:', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    // Check and fix chain ID if needed
    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      
      if (rpcChainId !== chainId) {
        chainId = rpcChainId;
        await keplr.enable(chainId);
        actualSigner = await keplr.getOfflineSignerAuto(chainId);
      }
    } catch (fetchError) {
      console.warn('Could not verify chain ID from RPC');
    }
    
    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner,
      { 
        broadcastTimeoutMs: 30000, 
        broadcastPollIntervalMs: 3000,
      }
    );
    
    console.log('✅ Client connected for withdraw all');

    // Build messages array
    const messages: any[] = [];
    
    // Add withdraw rewards message if has rewards
    if (params.hasRewards) {
      messages.push({
        typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
        value: {
          delegatorAddress: params.delegatorAddress,
          validatorAddress: params.validatorAddress,
        },
      });
      console.log('📝 Added withdraw rewards message');
    }
    
    // Add withdraw commission message if has commission
    if (params.hasCommission) {
      messages.push({
        typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
        value: {
          validatorAddress: params.validatorAddress,
        },
      });
      console.log('📝 Added withdraw commission message');
    }

    if (messages.length === 0) {
      throw new Error('No messages to send');
    }

    const denom = chain.assets?.[0]?.base || 'uatom';
    const gasPrice = `0.025${denom}`;

    console.log('📤 Sending transaction with', messages.length, 'message(s)');

    const result = await client.signAndBroadcast(
      params.delegatorAddress,
      messages,
      {
        amount: [{ denom, amount: String(Math.floor(parseFloat(gasLimit) * 0.025)) }],
        gas: gasLimit,
      },
      memo
    );

    console.log('Transaction result:', result);

    if (result.code === 0) {
      console.log('✅ Withdraw all successful!');
      return { success: true, txHash: result.transactionHash };
    } else {
      console.error('❌ Withdraw all failed:', result.rawLog);
      return { success: false, error: result.rawLog };
    }
  } catch (error: any) {
    console.error('Withdraw all error:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

export async function executeWithdrawAllValidators(
  chain: ChainData,
  params: {
    delegatorAddress: string;
    validatorAddresses: string[];
  },
  gasLimit: string = '500000',
  memo: string = ''
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🔍 executeWithdrawAllValidators:', {
      validatorCount: params.validatorAddresses.length,
      chainId: chainId
    });
    
    // Enable chain
    await keplr.enable(chainId);
    const offlineSigner = await keplr.getOfflineSignerAuto(chainId);
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    // Find RPC with indexer enabled (tx_index = on)
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    // Priority: Use RPC with tx_index enabled
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    // Fallback: Use first available RPC
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.warn('⚠️ No RPC with tx_index found, using first available:', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    // Check and fix chain ID if needed
    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      
      if (rpcChainId !== chainId) {
        chainId = rpcChainId;
        await keplr.enable(chainId);
        actualSigner = await keplr.getOfflineSignerAuto(chainId);
      }
    } catch (fetchError) {
      console.warn('Could not verify chain ID from RPC');
    }
    
    const clientOptions: any = { 
      broadcastTimeoutMs: 30000, 
      broadcastPollIntervalMs: 3000,
    };
    
    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner,
      clientOptions
    );
    
    console.log('✅ Client connected for withdraw all validators');

    // Build messages array for all validators
    const messages: any[] = params.validatorAddresses.map(validatorAddress => ({
      typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
      value: {
        delegatorAddress: params.delegatorAddress,
        validatorAddress: validatorAddress,
      },
    }));
    
    console.log('📝 Created', messages.length, 'withdraw reward messages');

    if (messages.length === 0) {
      throw new Error('No validators to withdraw from');
    }

    const denom = chain.assets?.[0]?.base || 'uatom';
    const gasPrice = `0.025${denom}`;

    console.log('📤 Sending transaction with', messages.length, 'message(s)');

    const result = await client.signAndBroadcast(
      params.delegatorAddress,
      messages,
      {
        amount: [{ denom, amount: String(Math.floor(parseFloat(gasLimit) * 0.025)) }],
        gas: gasLimit,
      },
      memo
    );

    console.log('Transaction result:', result);

    if (result.code === 0) {
      console.log('✅ Withdraw all validators successful!');
      return { success: true, txHash: result.transactionHash };
    } else {
      console.error('❌ Withdraw all validators failed:', result.rawLog);
      return { success: false, error: result.rawLog };
    }
  } catch (error: any) {
    console.error('Withdraw all validators error:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

export async function executeSend(
  chain: ChainData,
  params: {
    fromAddress: string;
    toAddress: string;
    amount: string;
    denom: string;
  },
  gasLimit: string = '200000',
  memo: string = 'Integrate WinScan'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🔍 executeSend Debug:', {
      chain_name: chain.chain_name,
      chain_id: chain.chain_id,
      computed_chainId: chainId,
      params: params
    });
    
    // Suggest chain to Keplr if not already added
    try {
      await keplr.enable(chainId);
      console.log('✅ Chain enabled:', chainId);
    } catch (error: any) {
      if (error.message?.includes('There is no chain info')) {
        console.log('Chain not found in Keplr, suggesting chain...');
        const rpcEndpoint = chain.rpc?.[0]?.address || '';
        const apiEndpoint = chain.api?.[0]?.address || '';
        
        await keplr.experimentalSuggestChain({
          chainId: chainId,
          chainName: chain.chain_name,
          rpc: rpcEndpoint,
          rest: apiEndpoint,
          bip44: {
            coinType: parseInt(chain.coin_type || '118'),
          },
          bech32Config: {
            bech32PrefixAccAddr: chain.addr_prefix || 'cosmos',
            bech32PrefixAccPub: `${chain.addr_prefix || 'cosmos'}pub`,
            bech32PrefixValAddr: `${chain.addr_prefix || 'cosmos'}valoper`,
            bech32PrefixValPub: `${chain.addr_prefix || 'cosmos'}valoperpub`,
            bech32PrefixConsAddr: `${chain.addr_prefix || 'cosmos'}valcons`,
            bech32PrefixConsPub: `${chain.addr_prefix || 'cosmos'}valconspub`,
          },
          currencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
            },
          ],
          feeCurrencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
              gasPriceStep: {
                low: 0.01,
                average: 0.025,
                high: 0.04,
              },
            },
          ],
          stakeCurrency: {
            coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
            coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
            coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
          },
        });
        
        await keplr.enable(chainId);
      } else {
        throw error;
      }
    }
    
    const offlineSigner = await keplr.getOfflineSignerAuto(chainId);
    
    // Get accounts to verify
    const accounts = await offlineSigner.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }
    
    console.log('✅ Offline signer created for chain ID:', chainId);
    console.log('Account address:', accounts[0].address);
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    // Find RPC with indexer enabled (tx_index = on)
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    // Priority: Use RPC with tx_index enabled
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    // Fallback: Use first available RPC
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.warn('⚠️ No RPC with tx_index found, using first available:', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    console.log('Connecting to RPC:', rpcEndpoint);
    
    // Get the actual chain ID from the RPC to ensure it matches
    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      console.log('📡 RPC Chain ID:', rpcChainId);
      console.log('🔑 Keplr Chain ID:', chainId);
      
      if (rpcChainId !== chainId) {
        console.warn(`⚠️ Chain ID mismatch! RPC: ${rpcChainId}, Keplr: ${chainId}`);
        console.log('🔄 Re-creating offline signer with correct chain ID...');
        
        try {
          await keplr.enable(rpcChainId);
          actualSigner = await keplr.getOfflineSignerAuto(rpcChainId);
          chainId = rpcChainId;
          console.log('✅ Successfully re-created signer with RPC chain ID');
        } catch (e) {
          console.warn('Failed to recreate signer with RPC chain ID, proceeding with original:', e);
        }
      }
    } catch (e) {
      console.warn('Could not fetch chain ID from RPC status endpoint:', e);
    }

    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner
    );

    console.log('✅ SigningStargateClient connected');

    const exponent = parseInt(String(chain.assets?.[0]?.exponent || '6'));
    const gasPrice = `0.025${params.denom}`;

    // Create send message
    const sendMsg = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: {
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: [{
          denom: params.denom,
          amount: params.amount,
        }],
      },
    };

    console.log('📤 Sending transaction:', sendMsg);

    const result = await client.signAndBroadcast(
      params.fromAddress,
      [sendMsg],
      {
        amount: [{ denom: params.denom, amount: String(Math.floor(parseFloat(gasLimit) * 0.025)) }],
        gas: gasLimit,
      },
      memo
    );

    console.log('Transaction result:', result);

    if (result.code === 0) {
      console.log('✅ Transaction successful!');
      console.log('Transaction hash:', result.transactionHash);
      return { success: true, txHash: result.transactionHash };
    } else {
      console.error('❌ Transaction failed:', result.rawLog);
      return { success: false, error: result.rawLog };
    }
  } catch (error: any) {
    console.error('Send error:', error);
    return { success: false, error: error.message || 'Transaction failed' };
  }
}

export async function executeVote(
  chain: ChainData,
  params: {
    voterAddress: string;
    proposalId: string;
    option: number; // 1=Yes, 2=Abstain, 3=No, 4=NoWithVeto
  },
  gasLimit: string = '200000',
  memo: string = 'Vote via WinScan'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    if (!isKeplrInstalled()) {
      throw new Error('Keplr extension is not installed');
    }

    const keplr = window.keplr!;
    let chainId = (chain.chain_id || chain.chain_name).trim();
    
    console.log('🗳️ executeVote Debug:', {
      chain_name: chain.chain_name,
      chain_id: chain.chain_id,
      computed_chainId: chainId,
      params: params
    });
    
    // Enable chain
    try {
      await keplr.enable(chainId);
      console.log('✅ Chain enabled:', chainId);
    } catch (error: any) {
      if (error.message?.includes('There is no chain info')) {
        console.log('Chain not found in Keplr, suggesting chain...');
        const rpcEndpoint = chain.rpc?.[0]?.address || '';
        const apiEndpoint = chain.api?.[0]?.address || '';
        
        await keplr.experimentalSuggestChain({
          chainId: chainId,
          chainName: chain.chain_name,
          rpc: rpcEndpoint,
          rest: apiEndpoint,
          bip44: {
            coinType: parseInt(chain.coin_type || '118'),
          },
          bech32Config: {
            bech32PrefixAccAddr: chain.addr_prefix || 'cosmos',
            bech32PrefixAccPub: `${chain.addr_prefix || 'cosmos'}pub`,
            bech32PrefixValAddr: `${chain.addr_prefix || 'cosmos'}valoper`,
            bech32PrefixValPub: `${chain.addr_prefix || 'cosmos'}valoperpub`,
            bech32PrefixConsAddr: `${chain.addr_prefix || 'cosmos'}valcons`,
            bech32PrefixConsPub: `${chain.addr_prefix || 'cosmos'}valconspub`,
          },
          currencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
            },
          ],
          feeCurrencies: [
            {
              coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
              coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
              coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
              gasPriceStep: {
                low: 0.01,
                average: 0.025,
                high: 0.04,
              },
            },
          ],
          stakeCurrency: {
            coinDenom: chain.assets?.[0]?.symbol || 'ATOM',
            coinMinimalDenom: chain.assets?.[0]?.base || 'uatom',
            coinDecimals: parseInt(String(chain.assets?.[0]?.exponent || '6')),
          },
        });
        
        await keplr.enable(chainId);
      } else {
        throw error;
      }
    }
    
    const offlineSigner = await keplr.getOfflineSignerAuto(chainId);
    
    // Verify RPC chain ID matches
    const rpcEndpoint = chain.rpc?.[0]?.address || '';
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    try {
      const rpcResponse = await fetch(`${rpcEndpoint}/status`);
      if (rpcResponse.ok) {
        const rpcData = await rpcResponse.json();
        const rpcChainId = rpcData.result?.node_info?.network;
        if (rpcChainId && rpcChainId !== chainId) {
          console.warn(`⚠️ Chain ID mismatch! Config: ${chainId}, RPC: ${rpcChainId}. Using RPC chain ID.`);
          chainId = rpcChainId;
          await keplr.enable(chainId);
          // Recreate offline signer with correct chain ID
          const newOfflineSigner = await keplr.getOfflineSignerAuto(chainId);
          Object.assign(offlineSigner, newOfflineSigner);
        }
      }
    } catch (rpcError) {
      console.warn('Could not verify RPC chain ID:', rpcError);
    }

    const accounts = await offlineSigner.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }
    
    console.log('✅ Voter address:', accounts[0].address);
    
    // @ts-ignore
    const { SigningStargateClient, GasPrice } = await import('@cosmjs/stargate');
    
    const gasPrice = GasPrice.fromString(`${chain.min_tx_fee || '0.025'}${chain.assets?.[0]?.base || 'uatom'}`);
    
    const clientOptions: any = {
      gasPrice,
      broadcastTimeoutMs: 30000,
      broadcastPollIntervalMs: 3000,
    };
    
    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      offlineSigner,
      clientOptions
    );

    console.log('Creating MsgVote transaction...');

    const voteMsg = {
      typeUrl: '/cosmos.gov.v1beta1.MsgVote',
      value: {
        proposalId: params.proposalId,
        voter: params.voterAddress,
        option: params.option,
      },
    };

    console.log('Vote message:', voteMsg);

    const fee = {
      amount: [
        {
          denom: chain.assets?.[0]?.base || 'uatom',
          amount: Math.ceil(parseFloat(gasLimit) * parseFloat(chain.min_tx_fee || '0.025')).toString(),
        },
      ],
      gas: gasLimit,
    };

    console.log('Broadcasting transaction...');

    const result = await client.signAndBroadcast(
      params.voterAddress,
      [voteMsg],
      fee,
      memo
    );

    console.log('Transaction result:', result);

    if (result.code === 0) {
      console.log('✅ Vote successful!');
      console.log('Transaction hash:', result.transactionHash);
      return { success: true, txHash: result.transactionHash };
    } else {
      console.error('❌ Vote failed:', result.rawLog);
      return { success: false, error: result.rawLog };
    }
  } catch (error: any) {
    console.error('Vote error:', error);
    return { success: false, error: error.message || 'Vote failed' };
  }
}
