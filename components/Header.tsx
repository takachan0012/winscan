'use client';
import { Search, Home } from 'lucide-react';
import ChainSelector from './ChainSelector';
import LanguageSwitcher from './LanguageSwitcher';
import LatestBlocksHeader from './LatestBlocksHeader';
import PriceTracker from './PriceTracker';
import dynamic from 'next/dynamic';
import { ChainData } from '@/types/chain';
import { useState, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
const KeplrWallet = dynamic(() => import('./KeplrWallet'), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg">
      <div className="w-24 h-8 bg-gray-800 animate-pulse rounded" />
    </div>
  ),
});
interface HeaderProps {
  chains: ChainData[];
  selectedChain: ChainData | null;
  onSelectChain: (chain: ChainData) => void;
}
function Header({ chains, selectedChain, onSelectChain }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const chainPath = useMemo(() => 
    selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '',
    [selectedChain]
  );
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !selectedChain) return;
    const query = searchQuery.trim();
    if (/^\d+$/.test(query)) {
      router.push(`/${chainPath}/blocks/${query}`);
    } else if (/^[A-F0-9]{64}$/i.test(query)) {
      router.push(`/${chainPath}/transactions/${query}`);
    } else if (query.startsWith(selectedChain.addr_prefix)) {
      router.push(`/${chainPath}/accounts/${query}`);
    } else {
      router.push(`/${chainPath}/transactions?q=${query}`);
    }
    setSearchQuery('');
  }, [searchQuery, selectedChain, chainPath, router]);
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);
  const handleHomeClick = useCallback(() => {
    router.push('/');
  }, [router]);
  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 h-16 bg-[#0f0f0f] border-b border-gray-800 z-20 flex items-center px-4 md:px-6">
      <div className="flex items-center justify-between w-full ml-12 md:ml-0 gap-4">
        <div className="flex items-center gap-3">
          {/* Home Button */}
          <button
            onClick={handleHomeClick}
            className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors duration-200"
            title="Back to Home"
          >
            <Home className="w-5 h-5 text-gray-400" />
            <span className="hidden md:inline text-sm text-gray-300">Home</span>
          </button>
          
          {/* Latest Blocks Header - Real-time */}
          <LatestBlocksHeader selectedChain={selectedChain} />
          
          {/* Price Tracker */}
          <PriceTracker selectedChain={selectedChain} />
        </div>
        
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-2xl hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              placeholder="Search blocks, transactions, addresses..."
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all duration-200"
              autoComplete="off"
            />
          </div>
        </form>
        
        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <ChainSelector 
            chains={chains} 
            selectedChain={selectedChain} 
            onSelectChain={onSelectChain}
          />
          <LanguageSwitcher />
          <KeplrWallet selectedChain={selectedChain} />
        </div>
      </div>
    </header>
  );
}
export default memo(Header);
