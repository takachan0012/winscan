'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ProposalsTable from '@/components/ProposalsTable';
import { ChainData } from '@/types/chain';
import { getApiUrl } from '@/lib/config';
import { Vote, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { fetchProposalsDirectly } from '@/lib/cosmos-client';

interface Proposal {
  id: string;
  title: string;
  status: string;
  type: string;
  submitTime: string;
  votingStartTime: string;
  votingEndTime: string;
  yesVotes: string;
  noVotes: string;
  abstainVotes: string;
  vetoVotes: string;
}

export default function ProposalsPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'voting' | 'passed' | 'rejected'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = params?.chain as string;
      const chain = chainName 
        ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
        : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
      if (chain) setSelectedChain(chain);
    } else {
      fetch('/api/chains')
        .then(res => res.json())
        .then(data => {
          sessionStorage.setItem('chains', JSON.stringify(data));
          setChains(data);
          const chainName = params?.chain as string;
          const chain = chainName 
            ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
            : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
          if (chain) setSelectedChain(chain);
        })
        .catch(() => {});
    }
  }, [params]);

  useEffect(() => {
    if (!selectedChain) return;
    
    const cacheKey = `proposals_${selectedChain.chain_name}`;
    const cacheTimeout = 600000; // 10 minutes
    
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        setProposals(data);
        setLoading(false);
        if (Date.now() - timestamp < cacheTimeout) {
          return;
        }
      }
    } catch (e) {}
    
    // Async fetch with direct LCD support
    const fetchProposals = async () => {
      try {
        // Strategy 1: Try backend API first (faster, cached)
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ssl.winsnip.xyz';
        const backendUrl = `${API_URL}/api/proposals?chain=${selectedChain.chain_id || selectedChain.chain_name}`;
        
        try {
          const res = await fetch(backendUrl, {
            signal: AbortSignal.timeout(8000), // 8 second timeout
          });
          
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length >= 0) {
              const transformedData = data.map((p: any) => ({
                id: p.proposal_id || p.id,
                title: p.content?.title || p.title || `Proposal #${p.proposal_id || p.id}`,
                status: p.status,
                type: p.content?.['@type'] || p.messages?.[0]?.['@type'] || p.type || 'Unknown',
                submitTime: p.submit_time || p.submitTime,
                votingStartTime: p.voting_start_time || p.votingStartTime,
                votingEndTime: p.voting_end_time || p.votingEndTime,
                yesVotes: p.final_tally_result?.yes || p.final_tally_result?.yes_count || p.yesVotes || '0',
                noVotes: p.final_tally_result?.no || p.final_tally_result?.no_count || p.noVotes || '0',
                abstainVotes: p.final_tally_result?.abstain || p.final_tally_result?.abstain_count || p.abstainVotes || '0',
                vetoVotes: p.final_tally_result?.no_with_veto || p.final_tally_result?.no_with_veto_count || p.vetoVotes || '0',
              }));
              
              transformedData.sort((a: any, b: any) => {
                const idA = parseInt(a.id) || 0;
                const idB = parseInt(b.id) || 0;
                return idB - idA;
              });
              
              setProposals(transformedData);
              setLoading(false);
              try {
                sessionStorage.setItem(cacheKey, JSON.stringify({ data: transformedData, timestamp: Date.now() }));
              } catch (e) {}
              return;
            }
          }
        } catch (backendError) {
          console.warn('[Proposals] Backend API failed, falling back to LCD:', backendError);
        }
        
        // Strategy 2: Fallback to direct LCD fetch
        const lcdEndpoints = selectedChain.api?.map(api => ({
          address: api.address,
          provider: api.provider || 'Unknown'
        })) || [];
        
        if (lcdEndpoints.length > 0) {
          console.log(`[Proposals] Using direct LCD fetch for ${selectedChain.chain_name}`);
          
          try {
            // Fetch multiple statuses in parallel
            const [voting, passed, rejected] = await Promise.allSettled([
              fetchProposalsDirectly(lcdEndpoints, 'PROPOSAL_STATUS_VOTING_PERIOD', 50),
              fetchProposalsDirectly(lcdEndpoints, 'PROPOSAL_STATUS_PASSED', 50),
              fetchProposalsDirectly(lcdEndpoints, 'PROPOSAL_STATUS_REJECTED', 50),
            ]);
            
            const allProposals = [
              ...(voting.status === 'fulfilled' ? voting.value : []),
              ...(passed.status === 'fulfilled' ? passed.value : []),
              ...(rejected.status === 'fulfilled' ? rejected.value : []),
            ];
            
            if (allProposals.length > 0) {
              const transformedData = allProposals.map((p: any) => ({
                id: p.proposal_id || p.id,
                title: p.content?.title || p.title || `Proposal #${p.proposal_id || p.id}`,
                status: p.status,
                type: p.content?.['@type'] || p.messages?.[0]?.['@type'] || p.type || 'Unknown',
                submitTime: p.submit_time || p.submitTime,
                votingStartTime: p.voting_start_time || p.votingStartTime,
                votingEndTime: p.voting_end_time || p.votingEndTime,
                yesVotes: p.final_tally_result?.yes || p.final_tally_result?.yes_count || p.yesVotes || '0',
                noVotes: p.final_tally_result?.no || p.final_tally_result?.no_count || p.noVotes || '0',
                abstainVotes: p.final_tally_result?.abstain || p.final_tally_result?.abstain_count || p.abstainVotes || '0',
                vetoVotes: p.final_tally_result?.no_with_veto || p.final_tally_result?.no_with_veto_count || p.vetoVotes || '0',
              }));
              
              transformedData.sort((a: any, b: any) => {
                const idA = parseInt(a.id) || 0;
                const idB = parseInt(b.id) || 0;
                return idB - idA;
              });
              
              setProposals(transformedData);
              setLoading(false);
              try {
                sessionStorage.setItem(cacheKey, JSON.stringify({ data: transformedData, timestamp: Date.now() }));
              } catch (e) {}
              return;
            }
          } catch (directError) {
            console.warn('[Proposals] Direct LCD fetch failed:', directError);
            // Check if it's a "Not Implemented" error
            if (directError && typeof directError === 'object' && 'message' in directError) {
              const errorMsg = (directError as Error).message;
              if (errorMsg.includes('501') || errorMsg.includes('Not Implemented') || errorMsg.includes('12')) {
                setError('governance_not_available');
                setLoading(false);
                return;
              }
            }
          }
        }
        
        // No data found
        setProposals([]);
        setLoading(false);
        
      } catch (err) {
        console.error('[Proposals] Failed to fetch:', err);
        setLoading(false);
        setError('fetch_failed');
      }
    };
    
    fetchProposals();
  }, [selectedChain]);

  const filteredProposals = proposals.filter(p => {
    if (filter === 'voting') return p.status === 'PROPOSAL_STATUS_VOTING_PERIOD';
    if (filter === 'passed') return p.status === 'PROPOSAL_STATUS_PASSED';
    if (filter === 'rejected') return p.status === 'PROPOSAL_STATUS_REJECTED';
    return true;
  });

  const stats = {
    total: proposals.length,
    voting: proposals.filter(p => p.status === 'PROPOSAL_STATUS_VOTING_PERIOD').length,
    passed: proposals.filter(p => p.status === 'PROPOSAL_STATUS_PASSED').length,
    rejected: proposals.filter(p => p.status === 'PROPOSAL_STATUS_REJECTED').length,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header 
          chains={chains}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />

        <main className="flex-1 mt-16 p-6 overflow-auto">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl p-4">
                <Vote className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">{t('proposals.title')}</h1>
                <p className="text-gray-400 mt-1">
                  {t('proposals.subtitle')} {selectedChain?.chain_name}
                </p>
              </div>
            </div>
          </div>

          {loading && proposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/20 border-t-blue-500"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/10 animate-pulse"></div>
              </div>
              <p className="text-gray-400 text-lg font-medium mt-6">{t('proposals.loading')}</p>
              <p className="text-gray-500 text-sm mt-2">{t('proposals.fetchingData')}</p>
            </div>
          ) : error === 'governance_not_available' ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="bg-yellow-500/10 rounded-full p-6 mb-6">
                <Vote className="w-16 h-16 text-yellow-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Governance Not Available</h3>
              <p className="text-gray-400 text-center max-w-md mb-4">
                The governance module is not enabled or implemented on this chain yet.
              </p>
              <p className="text-gray-500 text-sm text-center max-w-md">
                Chain: <span className="text-blue-400 font-mono">{selectedChain?.chain_name}</span>
              </p>
              <div className="mt-6 bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 max-w-md">
                <p className="text-gray-400 text-sm">
                  <strong className="text-white">Note:</strong> Some chains use custom governance systems or haven't activated on-chain governance yet.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Total Proposals */}
                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-blue-500/10 rounded-xl p-3">
                      <TrendingUp className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-3xl font-bold text-white">{stats.total}</span>
                  </div>
                  <h3 className="text-gray-400 text-sm font-medium">{t('proposals.total')}</h3>
                  <p className="text-gray-500 text-xs mt-1">{t('proposals.allTime')}</p>
                </div>

                {/* Voting */}
                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-2xl p-6 hover:border-yellow-500/50 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-yellow-500/10 rounded-xl p-3">
                      <Clock className="w-6 h-6 text-yellow-400" />
                    </div>
                    <span className="text-3xl font-bold text-yellow-400">{stats.voting}</span>
                  </div>
                  <h3 className="text-gray-400 text-sm font-medium">{t('proposals.activeVoting')}</h3>
                  <p className="text-gray-500 text-xs mt-1">{t('proposals.currentlyOpen')}</p>
                </div>

                {/* Passed */}
                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-2xl p-6 hover:border-green-500/50 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-green-500/10 rounded-xl p-3">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    </div>
                    <span className="text-3xl font-bold text-green-400">{stats.passed}</span>
                  </div>
                  <h3 className="text-gray-400 text-sm font-medium">{t('proposals.passed')}</h3>
                  <p className="text-gray-500 text-xs mt-1">
                    {stats.total > 0 ? `${((stats.passed / stats.total) * 100).toFixed(0)}% ${t('proposals.approval')}` : '0%'}
                  </p>
                </div>

                {/* Rejected */}
                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#141414] border border-gray-800 rounded-2xl p-6 hover:border-red-500/50 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-red-500/10 rounded-xl p-3">
                      <XCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <span className="text-3xl font-bold text-red-400">{stats.rejected}</span>
                  </div>
                  <h3 className="text-gray-400 text-sm font-medium">{t('proposals.rejected')}</h3>
                  <p className="text-gray-500 text-xs mt-1">
                    {stats.total > 0 ? `${((stats.rejected / stats.total) * 100).toFixed(0)}% rejected` : '0%'}
                  </p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="mb-6 flex flex-wrap gap-3">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    filter === 'all'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                  }`}
                >
                  {t('proposals.filterAll')}
                  <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                    filter === 'all' ? 'bg-white/20' : 'bg-gray-700'
                  }`}>
                    {proposals.length}
                  </span>
                </button>
                <button
                  onClick={() => setFilter('voting')}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    filter === 'voting'
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/30'
                      : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                  }`}
                >
                  <Clock className="w-4 h-4 inline mr-2" />
                  {t('proposals.filterVoting')}
                  <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                    filter === 'voting' ? 'bg-white/20' : 'bg-gray-700'
                  }`}>
                    {stats.voting}
                  </span>
                </button>
                <button
                  onClick={() => setFilter('passed')}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    filter === 'passed'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                      : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  {t('proposals.filterPassed')}
                  <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                    filter === 'passed' ? 'bg-white/20' : 'bg-gray-700'
                  }`}>
                    {stats.passed}
                  </span>
                </button>
                <button
                  onClick={() => setFilter('rejected')}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    filter === 'rejected'
                      ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/30'
                      : 'bg-[#1a1a1a] text-gray-400 hover:bg-gray-800 border border-gray-800'
                  }`}
                >
                  <XCircle className="w-4 h-4 inline mr-2" />
                  {t('proposals.filterRejected')}
                  <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${
                    filter === 'rejected' ? 'bg-white/20' : 'bg-gray-700'
                  }`}>
                    {stats.rejected}
                  </span>
                </button>
              </div>

              <ProposalsTable 
                proposals={filteredProposals} 
                chainName={selectedChain?.chain_name || ''}
                chain={selectedChain}
                t={t}
              />
            </>
          )}
        </main>

        <footer className="border-t border-gray-800 py-6 px-6 mt-auto">
          <div className="text-center text-gray-400 text-sm">
            <p>© 2025 WinScan. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

