import { ChainData } from '@/types/chain';
import { 
  signTransactionForEvm, 
  broadcastTransaction,
  fetchAccountWithEthSupport 
} from './evmSigning';

function calculateFee(chain: ChainData, gasLimit: string): { amount: Array<{ denom: string; amount: string }>; gas: string } {
  const denom = chain.assets?.[0]?.base || 'uatom';
  const exponent = parseInt(String(chain.assets?.[0]?.exponent || '6'));
  
  let feeAmount: string;
  
  if (chain.gas_price) {
    const gasPricePerUnit = parseFloat(chain.gas_price);
    const gasLimitNum = parseFloat(gasLimit);
    feeAmount = Math.ceil(gasLimitNum * gasPricePerUnit).toString();
  } else if (exponent >= 18) {
    const gasLimitNum = parseFloat(gasLimit);
    feeAmount = Math.ceil(gasLimitNum * 833333333333).toString();
  } else if (exponent >= 12) {
    const minFee = parseFloat(chain.min_tx_fee || '0.025');
    const multiplier = Math.pow(10, exponent - 6);
    const baseFee = parseFloat(gasLimit) * minFee * multiplier;
    feeAmount = Math.ceil(baseFee * 2).toString();
  } else {
    const minFee = parseFloat(chain.min_tx_fee || '0.025');
    feeAmount = Math.ceil(parseFloat(gasLimit) * minFee).toString();
  }
  
  return {
    amount: [{ denom, amount: feeAmount }],
    gas: gasLimit,
  };
}

async function createEvmAccountParser() {
  try {
    const { accountFromAny } = await import('@cosmjs/stargate');
    
    return (input: any) => {
      try {
        if (input.typeUrl === '/ethermint.types.v1.EthAccount') {
          console.log('🔍 Parsing EthAccount (Amino mode - will query from chain)');
          
          return {
            address: '',
            pubkey: null,
            accountNumber: 0,
            sequence: 0,
          };
        }
        
        return accountFromAny(input);
      } catch (error) {
        console.error('Account parser error:', error);
        try {
          return accountFromAny(input);
        } catch (fallbackError) {
          console.error('Fallback parser also failed:', fallbackError);
          return {
            address: '',
            pubkey: null,
            accountNumber: 0,
            sequence: 0,
          };
        }
      }
    };
  } catch (error) {
    console.error('Error creating account parser:', error);
    return null;
  }
}

async function createEvmRegistry() {
  try {
    const { Registry } = await import('@cosmjs/proto-signing');
    const { defaultRegistryTypes } = await import('@cosmjs/stargate');
    
    if (typeof Registry !== 'function') {
      console.warn('Registry is not a constructor, using default registry');
      return null;
    }
    
    const registry = new Registry(defaultRegistryTypes);
    
    console.log('✅ Created EVM-compatible registry with default types');
    return registry;
  } catch (error) {
    console.error('Error creating EVM registry:', error);
    return null;
  }
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
    coinImageUrl?: string;
  }>;
  feeCurrencies: Array<{
    coinDenom: string;
    coinMinimalDenom: string;
    coinDecimals: number;
    coinGeckoId?: string;
    coinImageUrl?: string;
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
    coinImageUrl?: string;
  };
  features?: string[];
}
export interface KeplrAccount {
  address: string;
  algo: string;
  pubKey: Uint8Array;
  isNanoLedger: boolean;
}
export function convertChainToKeplr(chain: ChainData, coinType?: 118 | 60): KeplrChainInfo {
  // Auto-detect coin_type from chain config, fallback to 118 (Cosmos standard)
  const detectedCoinType = chain.coin_type ? parseInt(chain.coin_type) as (118 | 60) : 118;
  const finalCoinType = coinType ?? detectedCoinType;
  
  const prefix = chain.addr_prefix || 'cosmos';
  const primaryAsset = chain.assets?.[0];
  
  console.log('🔧 Converting chain to Keplr config:', {
    chain: chain.chain_name,
    configCoinType: chain.coin_type,
    detectedCoinType,
    finalCoinType
  });
  
  return {
    chainId: chain.chain_id || chain.chain_name,
    chainName: chain.chain_name,
    rpc: chain.rpc?.[0]?.address || '',
    rest: chain.api?.[0]?.address || '',
    bip44: {
      coinType: finalCoinType,
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
      coinImageUrl: primaryAsset.logo,
    }] : [],
    feeCurrencies: primaryAsset ? [{
      coinDenom: primaryAsset.symbol,
      coinMinimalDenom: primaryAsset.base,
      coinDecimals: typeof primaryAsset.exponent === 'string' ? parseInt(primaryAsset.exponent) : primaryAsset.exponent,
      coinGeckoId: primaryAsset.coingecko_id,
      coinImageUrl: primaryAsset.logo,
      gasPriceStep: {
        low: chain.gas_price ? parseFloat(chain.gas_price) : parseFloat(chain.min_tx_fee || '0.01'),
        average: chain.gas_price ? parseFloat(chain.gas_price) * 1.5 : parseFloat(chain.min_tx_fee || '0.025') * 1.5,
        high: chain.gas_price ? parseFloat(chain.gas_price) * 2 : parseFloat(chain.min_tx_fee || '0.025') * 2,
      },
    }] : [],
    stakeCurrency: primaryAsset ? {
      coinDenom: primaryAsset.symbol,
      coinMinimalDenom: primaryAsset.base,
      coinDecimals: typeof primaryAsset.exponent === 'string' ? parseInt(primaryAsset.exponent) : primaryAsset.exponent,
      coinGeckoId: primaryAsset.coingecko_id,
      coinImageUrl: primaryAsset.logo,
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
  coinType?: 118 | 60
): Promise<KeplrAccount> {
  if (!isKeplrInstalled()) {
    throw new Error('Keplr extension is not installed');
  }
  const keplr = getKeplr();
  const chainInfo = convertChainToKeplr(chain, coinType);
  let chainId = chainInfo.chainId;
  
  // Auto-detect coinType from chain config if not provided
  const finalCoinType = coinType ?? (chain.coin_type ? parseInt(chain.coin_type) as (118 | 60) : 118);

  console.log('🔍 connectKeplr Debug:', {
    chain_name: chain.chain_name,
    chain_id: chain.chain_id,
    computed_chainId: chainId,
    configCoinType: chain.coin_type,
    finalCoinType
  });

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
          chainId = rpcChainId;
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
    } catch (enableError: any) {
      
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
      if (keyError.message?.includes('EthAccount') || keyError.message?.includes('Unsupported type')) {
        console.log('🔄 EthAccount type detected, reconnecting with EVM support...');
        
        const evmChainInfo = {
          ...chainInfo,
          features: ['eth-address-gen', 'eth-key-sign', 'ibc-transfer'],
        };
        
        await keplr.experimentalSuggestChain(evmChainInfo);
        await new Promise(resolve => setTimeout(resolve, 500));
        await keplr.enable(chainId);
        
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
      getOfflineSignerOnlyAmino: (chainId: string) => Promise<any>;
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
    
    try {
      await keplr.enable(chainId);
      console.log('✅ Chain enabled:', chainId);
    } catch (error: any) {
      if (error.message?.includes('There is no chain info')) {
        console.log('Chain not found in Keplr, suggesting chain...');
        const rpcEndpoint = chain.rpc?.[0]?.address || '';
        const apiEndpoint = chain.api?.[0]?.address || '';
        const coinType = parseInt(chain.coin_type || '118');
        
        // For EVM chains with coin_type 60, use special Keplr config
        const keplrChainInfo: any = {
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
        };
        
        // Add EVM-specific features for coin_type 60
        if (coinType === 60) {
          keplrChainInfo.features = ['eth-address-gen', 'eth-key-sign'];
        } else {
          keplrChainInfo.features = ['ibc-transfer'];
        }
        
        await keplr.experimentalSuggestChain(keplrChainInfo);
        
        await keplr.enable(chainId);
      } else {
        throw error;
      }
    }
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    const coinType = parseInt(chain.coin_type || '118');
    
    // For EVM chains, use getOfflineSigner (Direct mode)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    const accounts = await offlineSigner.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    const rpcEndpoint = chain.rpc?.[0]?.address || '';
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      console.log('📡 RPC Chain ID:', rpcChainId);
      console.log('🔑 Keplr Chain ID:', chainId);
      
      if (rpcChainId !== chainId) {
        console.warn(`⚠️ Chain ID mismatch! RPC: ${rpcChainId}, Keplr: ${chainId}`);
        console.log('🔄 Re-creating offline signer with correct chain ID...');
        
        chainId = rpcChainId;
        
        await keplr.enable(chainId);
        
        actualSigner = await keplr.getOfflineSignerAuto(chainId);
        const correctedAccounts = await actualSigner.getAccounts();
        console.log('✅ Corrected offline signer created for chain ID:', chainId);
        console.log('Corrected account:', correctedAccounts[0].address);
        console.log('Corrected pubkey:', correctedAccounts[0].pubkey);
      }
    } catch (fetchError) {
      console.warn('Could not fetch chain ID from RPC, continuing with existing chainId:', chainId);
    }
    
    const clientOptions: any = { 
      broadcastTimeoutMs: 30000, 
      broadcastPollIntervalMs: 3000,
    };
    
    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain, adding EthAccount support');
      
      const registry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();
      
      if (registry) {
        clientOptions.registry = registry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    }
    
    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner,
      clientOptions
    );
    
    console.log('✅ SigningStargateClient connected');

    let msg: any;
    const denom = chain.assets?.[0]?.base || 'uatom';

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

    const fee = calculateFee(chain, gasLimit);

    if (isEvmChain) {
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        // Sign transaction with EVM support
        const signedTx = await signTransactionForEvm(
          offlineSigner,
          chainId,
          restEndpoint,
          params.delegatorAddress,
          [msg],
          fee,
          memo,
          coinType,
          false // Disable auto-simulation to avoid double approval
        );
        
        // Broadcast transaction
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    // Standard Cosmos SDK signing for non-EVM chains
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
    
    await keplr.enable(chainId);
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    
    // Use Direct signing for EVM chains (better ethsecp256k1 support)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    console.log('✅ Signer type:', isEvmChain ? 'Direct (EVM)' : 'Auto');
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.warn('⚠️ No RPC with tx_index found, using first available:', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

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

    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain, adding EthAccount support');
      
      const registry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();      if (registry) {
        clientOptions.registry = registry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    }
    
    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner,
      clientOptions
    );
    
    console.log('✅ Client connected for withdraw all');

    const messages: any[] = [];
    
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

    const fee = calculateFee(chain, gasLimit);

    const coinType = parseInt(chain.coin_type || '118');
    // Use EVM signing for chains with underscore in chain_id (regardless of coin_type)
    if (isEvmChain) {
      console.log('🔥 Using EVM-specific signing for withdraw all (EVM chain detected)');
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        const signedTx = await signTransactionForEvm(
          offlineSigner,
          chainId,
          restEndpoint,
          params.delegatorAddress,
          messages,
          fee,
          memo,
          coinType,
          false // Disable simulation
        );
        
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        console.log('✅ EVM transaction successful!');
        console.log('Transaction hash:', result.txhash);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    const result = await client.signAndBroadcast(
      params.delegatorAddress,
      messages,
      fee,
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
    
    await keplr.enable(chainId);
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    
    // Use Direct signing for EVM chains (better ethsecp256k1 support)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    console.log('✅ Signer type:', isEvmChain ? 'Direct (EVM)' : 'Auto');
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.warn('⚠️ No RPC with tx_index found, using first available:', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      
      if (rpcChainId !== chainId) {
        chainId = rpcChainId;
        await keplr.enable(chainId);
        // Re-detect if EVM chain after chainId correction
        const isEvmChainCorrected = chainId.includes('_');
        actualSigner = isEvmChainCorrected 
          ? await keplr.getOfflineSigner(chainId)
          : await keplr.getOfflineSignerAuto(chainId);
      }
    } catch (fetchError) {
      console.warn('Could not verify chain ID from RPC');
    }
    
    const clientOptions: any = { 
      broadcastTimeoutMs: 30000, 
      broadcastPollIntervalMs: 3000,
    };
    
    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain (executeWithdrawAllValidators), adding EthAccount support');
      
      const registry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();
      
      if (registry) {
        clientOptions.registry = registry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    }
    
    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner,
      clientOptions
    );
    
    console.log('✅ Client connected for withdraw all validators');

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

    const fee = calculateFee(chain, gasLimit);

    const coinType = parseInt(chain.coin_type || '118');
    // Use EVM signing for chains with underscore in chain_id (regardless of coin_type)
    if (isEvmChain) {
      console.log('🔥 Using EVM-specific signing for withdraw all validators (EVM chain detected)');
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        const signedTx = await signTransactionForEvm(
          offlineSigner,
          chainId,
          restEndpoint,
          params.delegatorAddress,
          messages,
          fee,
          memo,
          coinType,
          false // Disable simulation
        );
        
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        console.log('✅ EVM transaction successful!');
        console.log('Transaction hash:', result.txhash);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    const result = await client.signAndBroadcast(
      params.delegatorAddress,
      messages,
      fee,
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
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    
    // Use Direct signing for EVM chains (better ethsecp256k1 support)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    const accounts = await offlineSigner.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }
    
    console.log('✅ Offline signer created for chain ID:', chainId, isEvmChain ? '(Direct for EVM)' : '');
    console.log('Account address:', accounts[0].address);
    
    // @ts-ignore
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.warn('⚠️ No RPC with tx_index found, using first available:', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    console.log('Connecting to RPC:', rpcEndpoint);
    
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

    const clientOptions: any = {};

    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain (executeSend), adding EthAccount support');
      
      const registry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();      if (registry) {
        clientOptions.registry = registry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    }

    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualSigner,
      clientOptions
    );

    console.log('✅ SigningStargateClient connected');

    const exponent = parseInt(String(chain.assets?.[0]?.exponent || '6'));
    const gasPrice = `0.025${params.denom}`;

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

    const fee = calculateFee(chain, gasLimit);

    const coinType = parseInt(chain.coin_type || '118');
    if (isEvmChain) {
      console.log('🔥 Using EVM-specific signing for send (EVM chain)');
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        const signedTx = await signTransactionForEvm(
          offlineSigner,
          chainId,
          restEndpoint,
          params.fromAddress,
          [sendMsg],
          fee,
          memo,
          coinType
        );
        
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        console.log('✅ EVM transaction successful!');
        console.log('Transaction hash:', result.txhash);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    const result = await client.signAndBroadcast(
      params.fromAddress,
      [sendMsg],
      fee,
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
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    
    // Use Direct signing for EVM chains (better ethsecp256k1 support)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    console.log('✅ Signer type:', isEvmChain ? 'Direct (EVM)' : 'Auto');

    const rpcEndpoint = chain.rpc?.[0]?.address || '';
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available');
    }

    let actualOfflineSigner = offlineSigner;
    
    try {
      const rpcResponse = await fetch(`${rpcEndpoint}/status`);
      if (rpcResponse.ok) {
        const rpcData = await rpcResponse.json();
        const rpcChainId = rpcData.result?.node_info?.network;
        if (rpcChainId && rpcChainId !== chainId) {
          console.warn(`⚠️ Chain ID mismatch! Config: ${chainId}, RPC: ${rpcChainId}. Using RPC chain ID.`);
          chainId = rpcChainId;
          await keplr.enable(chainId);
          actualOfflineSigner = await keplr.getOfflineSignerAuto(chainId);
        }
      }
    } catch (rpcError) {
      console.warn('Could not verify RPC chain ID:', rpcError);
    }

    const accounts = await actualOfflineSigner.getAccounts();
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
    
    // Add EVM support if needed
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain (executeVote), adding EthAccount support');
      
      const evmRegistry = await createEvmRegistry();
      const accountParser = await createEvmAccountParser();
      
      if (evmRegistry) {
        clientOptions.registry = evmRegistry;
        console.log('✅ Using custom EVM registry');
      }
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser');
      }
    }
    
    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint,
      actualOfflineSigner,
      clientOptions
    );    console.log('Creating MsgVote transaction...');

    const voteMsg = {
      typeUrl: '/cosmos.gov.v1beta1.MsgVote',
      value: {
        proposalId: params.proposalId,
        voter: params.voterAddress,
        option: params.option,
      },
    };

    console.log('Vote message:', voteMsg);

    const fee = calculateFee(chain, gasLimit);

    console.log('Broadcasting transaction...');

    const coinType = parseInt(chain.coin_type || '118');
    if (isEvmChain) {
      console.log('🔥 Using EVM-specific signing for vote (EVM chain)');
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        const signedTx = await signTransactionForEvm(
          actualOfflineSigner,
          chainId,
          restEndpoint,
          params.voterAddress,
          [voteMsg],
          fee,
          memo,
          coinType
        );
        
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        console.log('✅ EVM transaction successful!');
        console.log('Transaction hash:', result.txhash);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

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

export async function executeUnjail(
  chain: ChainData,
  params: {
    validatorAddress: string;
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
    
    console.log('🔓 executeUnjail:', {
      validatorAddress: params.validatorAddress,
      chainId: chainId
    });
    
    await keplr.enable(chainId);
    
    // Detect EVM chain for proper signer selection
    const isEvmChain = chainId.includes('_');
    
    // Use Direct signing for EVM chains (better ethsecp256k1 support)
    const offlineSigner = isEvmChain 
      ? await keplr.getOfflineSigner(chainId)
      : await keplr.getOfflineSignerAuto(chainId);
    
    console.log('✅ Signer type:', isEvmChain ? 'Direct (EVM)' : 'Auto');
    
    // @ts-ignore - Import required modules
    const { SigningStargateClient } = await import('@cosmjs/stargate');
    // @ts-ignore
    const { Registry } = await import('@cosmjs/proto-signing');
    // @ts-ignore
    const { defaultRegistryTypes } = await import('@cosmjs/stargate');
    // @ts-ignore
    const { MsgUnjail } = await import('cosmjs-types/cosmos/slashing/v1beta1/tx');
    
    // @ts-ignore - Registry types are complex, ignore for custom message
    const registry = new Registry([
      ...defaultRegistryTypes,
      ['/cosmos.slashing.v1beta1.MsgUnjail', MsgUnjail],
    ]);
    
    // Add EVM support for chains like Shido
    if (isEvmChain) {
      console.log('🔧 Detected EVM chain, using Direct signing');
    }
    
    console.log('✅ Custom registry created with MsgUnjail' + (isEvmChain ? ' and EVM support' : ''));
    
    let rpcEndpoint = '';
    const rpcList = chain.rpc || [];
    
    for (const rpc of rpcList) {
      if (rpc.tx_index === 'on') {
        rpcEndpoint = rpc.address;
        console.log('✅ Using RPC with tx_index enabled:', rpcEndpoint);
        break;
      }
    }
    
    if (!rpcEndpoint && rpcList.length > 0) {
      rpcEndpoint = rpcList[0].address;
      console.log('⚠️ Using first available RPC (no tx_index info):', rpcEndpoint);
    }
    
    if (!rpcEndpoint) {
      throw new Error('No RPC endpoint available for this chain');
    }

    let actualSigner = offlineSigner;
    try {
      const statusResponse = await fetch(`${rpcEndpoint}/status`);
      const statusData = await statusResponse.json();
      const rpcChainId = statusData.result.node_info.network;
      
      if (rpcChainId !== chainId) {
      console.log('🔄 Updating chain ID from', chainId, 'to', rpcChainId);
      chainId = rpcChainId;
      await keplr.enable(chainId);
      
      // Re-get signer with correct method for chain type
      if (isEvmChain) {
        actualSigner = await keplr.getOfflineSigner(chainId);
        console.log('✅ Got EVM signer for unjail with updated chain ID');
      } else {
        actualSigner = await keplr.getOfflineSignerAuto(chainId);
      }
    }
  } catch (fetchError) {
    console.warn('Could not verify chain ID from RPC');
  }

    const clientOptions: any = {
      registry,
      broadcastTimeoutMs: 30000,
      broadcastPollIntervalMs: 3000,
    };
    
    // Add EVM account parser if needed
    if (isEvmChain) {
      console.log('🔧 Adding EVM account parser for executeUnjail');
      
      const accountParser = await createEvmAccountParser();
      
      if (accountParser) {
        clientOptions.accountParser = accountParser;
        console.log('✅ Using custom EVM account parser for unjail');
      }
    }

    const client = await SigningStargateClient.connectWithSigner(
      rpcEndpoint, 
      actualSigner,
      clientOptions
    );
    
    console.log('✅ SigningStargateClient connected with custom registry');
    
    const accounts = await actualSigner.getAccounts();
    const signerAddress = accounts[0].address;
    
    console.log('👤 Signer address:', signerAddress);
    console.log('🔓 Unjail validator:', params.validatorAddress);

    const unjailMsg = {
      typeUrl: '/cosmos.slashing.v1beta1.MsgUnjail',
      value: {
        validatorAddr: params.validatorAddress,
      },
    };

    console.log('📝 Unjail message:', unjailMsg);

    const fee = calculateFee(chain, gasLimit);

    console.log('💰 Fee:', fee);
    console.log('📄 Memo:', memo || 'Unjail via WinScan');

    const coinType = parseInt(chain.coin_type || '118');
    if (isEvmChain) {
      console.log('🔥 Using EVM-specific signing for unjail (EVM chain)');
      
      try {
        const restEndpoint = chain.api[0]?.address || '';
        if (!restEndpoint) {
          throw new Error('No REST endpoint available');
        }
        
        const signedTx = await signTransactionForEvm(
          actualSigner,
          chainId,
          restEndpoint,
          signerAddress,
          [unjailMsg],
          fee,
          memo || 'Unjail via WinScan',
          coinType
        );
        
        const result = await broadcastTransaction(restEndpoint, signedTx);
        
        console.log('✅ EVM transaction successful!');
        console.log('Transaction hash:', result.txhash);
        
        return { success: true, txHash: result.txhash };
      } catch (evmError: any) {
        console.error('❌ EVM signing/broadcast failed:', evmError);
        return { success: false, error: evmError.message };
      }
    }

    const result = await client.signAndBroadcast(
      signerAddress,
      [unjailMsg],
      fee,
      memo || 'Unjail via WinScan'
    );

    console.log('✅ Unjail result:', result);

    if (result.code === 0) {
      return {
        success: true,
        txHash: result.transactionHash,
      };
    } else {
      return {
        success: false,
        error: result.rawLog || 'Unjail transaction failed',
      };
    }
  } catch (error: any) {
    console.error('❌ Unjail error:', error);
    return { success: false, error: error.message || 'Unjail failed' };
  }
}
