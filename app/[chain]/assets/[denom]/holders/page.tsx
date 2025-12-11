'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import TopHolders from '@/components/TopHolders';
import IBCDenomMapping from '@/components/IBCDenomMapping';
import { ChainData } from '@/types/chain';
import { ArrowLeft, TrendingUp, Network } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';

export default function AssetHoldersPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const chainName = params.chain as string;
  const denom = decodeURIComponent(params.denom as string);
  
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [activeTab, setActiveTab] = useState<'holders' | 'mapping'>('holders');
  const [tokenLogo, setTokenLogo] = useState<string>('');
  
  // Check if denom is a PRC20 contract address
  const isPRC20 = denom.startsWith('paxi1') && denom.length > 40;

  useEffect(() => {
    async function loadChainData() {
      const response = await fetch('/chains.json');
      const data = await response.json();
      setChains(data);

      const chain = data.find((c: ChainData) => 
        c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase()
      ) || data[0];
      setSelectedChain(chain);
    }
    loadChainData();
  }, [chainName]);

  // Fetch token logo for PRC20
  useEffect(() => {
    if (isPRC20) {
      fetch(`/api/prc20-token-detail?contract=${encodeURIComponent(denom)}&query=marketing_info`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.logo?.url) {
            const logoUrl = data.logo.url.startsWith('ipfs://')
              ? `https://ipfs.io/ipfs/${data.logo.url.replace('ipfs://', '')}`
              : data.logo.url;
            setTokenLogo(logoUrl);
          }
        })
        .catch(() => {});
    }
  }, [denom, isPRC20]);

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <Sidebar 
        selectedChain={selectedChain}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          chains={chains}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />
        
        <main className="flex-1 overflow-y-auto p-6 pt-24">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href={`/${chainName}/assets/${encodeURIComponent(denom)}`}
                  className="p-2 bg-[#1a1a1a] border border-gray-800 hover:bg-[#0f0f0f] rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-400" />
                </Link>
                {isPRC20 && tokenLogo && (
                  <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-gray-700 flex-shrink-0 overflow-hidden">
                    <Image
                      src={tokenLogo}
                      alt="token"
                      width={48}
                      height={48}
                      className="object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-white">Asset Analytics</h1>
                  <p className="text-gray-400 font-mono text-sm mt-1">{denom}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-b border-gray-800 pb-4">
              <button
                onClick={() => setActiveTab('holders')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'holders'
                    ? 'bg-blue-500 text-white'
                    : 'bg-[#1a1a1a] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Top Holders
              </button>
              {!isPRC20 && (
                <button
                  onClick={() => setActiveTab('mapping')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === 'mapping'
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#1a1a1a] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                  }`}
                >
                  <Network className="w-4 h-4" />
                  IBC Mapping
                </button>
              )}
            </div>

            {activeTab === 'holders' && (
              <TopHolders chainName={chainName} denom={denom} />
            )}

            {activeTab === 'mapping' && !isPRC20 && (
              <IBCDenomMapping chainName={chainName} denom={denom} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
