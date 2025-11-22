import { ChainData } from '@/types/chain';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface MetaMaskAccount {
  address: string;
  chainId: string;
}

export function isMetaMaskInstalled(): boolean {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
}

export function getMetaMask() {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask extension is not installed. Please install it from https://metamask.io/');
  }
  return window.ethereum;
}

// Convert EVM chain ID (e.g., "shido_9008-1") to hex format for MetaMask
export function getEvmChainIdHex(chainId: string): string {
  // Extract numeric part from chain_id like "shido_9008-1" -> 9008
  const match = chainId.match(/_(\d+)-/);
  if (match) {
    const numericChainId = parseInt(match[1]);
    return '0x' + numericChainId.toString(16);
  }
  // Fallback: if format is different, try to parse the whole thing
  const fallbackMatch = chainId.match(/\d+/);
  if (fallbackMatch) {
    return '0x' + parseInt(fallbackMatch[0]).toString(16);
  }
  throw new Error(`Cannot parse EVM chain ID from: ${chainId}`);
}

export async function addEthereumChain(chain: ChainData): Promise<void> {
  const ethereum = getMetaMask();
  
  const chainIdHex = getEvmChainIdHex(chain.chain_id || chain.chain_name);
  const rpcUrl = chain.rpc?.[0]?.address || '';
  const blockExplorerUrl = `https://explorer.${chain.chain_name.replace('-mainnet', '').replace('-testnet', '')}.com`;
  
  const asset = chain.assets?.[0];
  
  try {
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: chainIdHex,
        chainName: chain.chain_name,
        nativeCurrency: {
          name: asset?.symbol || 'TOKEN',
          symbol: asset?.symbol || 'TOKEN',
          decimals: typeof asset?.exponent === 'string' ? parseInt(asset.exponent) : (asset?.exponent || 18),
        },
        rpcUrls: [rpcUrl],
        blockExplorerUrls: [blockExplorerUrl],
      }],
    });
    console.log('✅ Chain added to MetaMask');
  } catch (error: any) {
    if (error.code === 4902) {
      throw new Error('Please add this chain to MetaMask manually');
    }
    throw error;
  }
}

export async function switchEthereumChain(chain: ChainData): Promise<void> {
  const ethereum = getMetaMask();
  
  const chainIdHex = getEvmChainIdHex(chain.chain_id || chain.chain_name);
  
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
    console.log('✅ Switched to chain:', chainIdHex);
  } catch (error: any) {
    // Chain not added yet
    if (error.code === 4902) {
      console.log('Chain not found in MetaMask, adding...');
      await addEthereumChain(chain);
      // Try switching again
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } else {
      throw error;
    }
  }
}

export async function connectMetaMask(chain: ChainData): Promise<MetaMaskAccount> {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask extension is not installed');
  }
  
  const ethereum = getMetaMask();
  
  try {
    // Request account access
    const accounts = await ethereum.request({ 
      method: 'eth_requestAccounts' 
    }) as string[];
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found in MetaMask');
    }
    
    console.log('✅ MetaMask accounts:', accounts);
    
    // Switch to the correct chain
    await switchEthereumChain(chain);
    
    // Get current chain ID
    const chainId = await ethereum.request({ method: 'eth_chainId' }) as string;
    
    return {
      address: accounts[0],
      chainId: chainId,
    };
  } catch (error: any) {
    console.error('Failed to connect to MetaMask:', error);
    throw error;
  }
}

export function disconnectMetaMask(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('metamask_account');
    localStorage.removeItem('metamask_chain_id');
  }
}

export function saveMetaMaskAccount(account: MetaMaskAccount): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('metamask_account', JSON.stringify(account));
  }
}

export function getSavedMetaMaskAccount(): MetaMaskAccount | null {
  if (typeof window !== 'undefined') {
    const accountStr = localStorage.getItem('metamask_account');
    if (accountStr) {
      return JSON.parse(accountStr);
    }
  }
  return null;
}

// Convert hex address to bech32 format for Cosmos compatibility
export async function hexToBech32(hexAddress: string, prefix: string): Promise<string> {
  try {
    // Remove 0x prefix
    const cleanHex = hexAddress.replace('0x', '').toLowerCase();
    
    // Use addressConverter if available
    const { ethToBech32 } = await import('./addressConverter');
    return ethToBech32(hexAddress, prefix);
  } catch (error) {
    console.error('Failed to convert address:', error);
    return hexAddress; // Return original if conversion fails
  }
}

// Listen to account changes
export function onAccountsChanged(callback: (accounts: string[]) => void): void {
  if (isMetaMaskInstalled()) {
    window.ethereum.on('accountsChanged', callback);
  }
}

// Listen to chain changes
export function onChainChanged(callback: (chainId: string) => void): void {
  if (isMetaMaskInstalled()) {
    window.ethereum.on('chainChanged', callback);
  }
}

// Remove listeners
export function removeMetaMaskListeners(): void {
  if (isMetaMaskInstalled()) {
    window.ethereum.removeAllListeners('accountsChanged');
    window.ethereum.removeAllListeners('chainChanged');
  }
}
