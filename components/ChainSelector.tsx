'use client';
import { ChainData } from '@/types/chain';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { clearChainCache } from '@/lib/apiCache';
import { clearLoadBalancer } from '@/lib/loadBalancer';
import { useWallet } from '@/contexts/WalletContext';
import { disconnectKeplr } from '@/lib/keplr';
import { disconnectMetaMask } from '@/lib/metamask';
interface ChainSelectorProps {
  chains: ChainData[];
  selectedChain: ChainData | null;
  onSelectChain: (chain: ChainData) => void;
}
export default function ChainSelector({ chains, selectedChain, onSelectChain }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { setAccount } = useWallet();
  const handleChainSelect = async (chain: ChainData) => {
    if (switching) return;
    setSwitching(true);
    if (selectedChain && selectedChain.chain_name !== chain.chain_name) {
      // Disconnect wallet when switching chains
      disconnectKeplr();
      disconnectMetaMask();
      setAccount(null);
      window.dispatchEvent(new CustomEvent('keplr_wallet_changed'));
      
      // Clear cache
      const oldChainPath = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
      clearChainCache(oldChainPath);
      clearLoadBalancer(oldChainPath);    }
    onSelectChain(chain);
    setIsOpen(false);
    const newChainPath = chain.chain_name.toLowerCase().replace(/\s+/g, '-');
    const pathParts = pathname.split('/').filter(Boolean);
    const currentPage = pathParts.length > 1 ? pathParts.slice(1).join('/') : '';
    if (currentPage) {
      router.push(`/${newChainPath}/${currentPage}`);
    } else {
      router.push(`/${newChainPath}`);
    }
    setTimeout(() => setSwitching(false), 1000);
  };
  const getPrettyName = (chainName: string) => {
    return chainName.replace(/-mainnet$/i, '').replace(/-testnet$/i, ' Testnet');
  };
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="flex items-center space-x-2 bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-2 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selectedChain && (
          <>
            <img src={selectedChain.logo} alt={selectedChain.chain_name} className="w-6 h-6 rounded-full" />
            <span className="text-white">{getPrettyName(selectedChain.chain_name)}</span>
            {switching && <span className="text-xs text-blue-500">Switching...</span>}
          </>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-20 max-h-96 overflow-y-auto">
            {chains.map((chain) => (
              <button
                key={chain.chain_name}
                onClick={() => handleChainSelect(chain)}
                disabled={switching}
                className={`w-full flex items-center space-x-3 px-4 py-3 hover:bg-[#252525] transition-colors border-b border-gray-800 last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedChain?.chain_name === chain.chain_name ? 'bg-[#252525]' : ''
                }`}
              >
                <img src={chain.logo} alt={chain.chain_name} className="w-8 h-8 rounded-full" />
                <div className="flex-1 text-left">
                  <span className="text-white block">{getPrettyName(chain.chain_name)}</span>
                  {selectedChain?.chain_name === chain.chain_name && (
                    <span className="text-blue-500 text-xs">✓ Active</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
