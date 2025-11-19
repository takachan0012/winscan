'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { ChainData } from '@/types/chain';
import { formatDistanceToNow } from 'date-fns';
import { Box, Clock, Hash, User, FileText } from 'lucide-react';
import ValidatorAvatar from '@/components/ValidatorAvatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { fetchBlockByHeightDirectly, fetchValidatorsDirectly } from '@/lib/cosmos-client';

interface BlockDetail {
  height: number;
  hash: string;
  time: string;
  txs: number;
  proposer: string;
  proposerMoniker?: string;
  proposerIdentity?: string;
  proposerAddress?: string;
  gasUsed: string;
  gasWanted: string;
  transactions: Array<{
    hash: string;
    type: string;
    result: string;
  }>;
}

export default function BlockDetailPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [block, setBlock] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/chains')
      .then(res => res.json())
      .then(data => {
        setChains(data);
        const chainName = params?.chain as string;
        const chain = chainName 
          ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
          : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
        if (chain) setSelectedChain(chain);
      })
      .catch(err => console.error('Error loading chains:', err));
  }, [params]);

  useEffect(() => {
    if (selectedChain && params?.height) {
      setLoading(true);
      setBlock(null);
      const chainParam = selectedChain.chain_id || selectedChain.chain_name;
      console.log('Fetching block:', params.height, 'for chain:', chainParam);
      
      const fetchBlockData = async () => {
        try {
          // Strategy: Try direct LCD fetch first
          const lcdEndpoints = selectedChain.api?.map(api => ({
            address: api.address,
            provider: api.provider || 'Unknown'
          })) || [];
          
          if (lcdEndpoints.length > 0) {
            try {
              console.log(`[BlockDetail] Using direct LCD fetch for block ${params.height}`);
              
              // Fetch block and validators in parallel
              const [blockData, validators] = await Promise.all([
                fetchBlockByHeightDirectly(lcdEndpoints, params.height as string),
                fetchValidatorsDirectly(lcdEndpoints, 'BOND_STATUS_BONDED', 300).catch(() => [])
              ]);
              
              // Find validator by proposer address
              const proposerAddress = blockData.block.header.proposer_address;
              let validatorInfo = null;
              
              if (validators.length > 0) {
                // Convert proposer hex to match validator consensus pubkey
                const validator = validators.find((v: any) => {
                  // This is simplified - you might need proper address conversion
                  return v.consensus_pubkey?.key || false;
                });
                
                if (validator) {
                  validatorInfo = {
                    moniker: validator.description?.moniker,
                    identity: validator.description?.identity,
                    address: validator.operator_address
                  };
                }
              }
              
              const formattedBlock: BlockDetail = {
                height: parseInt(blockData.block.header.height),
                hash: blockData.block_id.hash,
                time: blockData.block.header.time,
                txs: blockData.block.data.txs?.length || 0,
                proposer: proposerAddress,
                proposerMoniker: validatorInfo?.moniker,
                proposerIdentity: validatorInfo?.identity,
                proposerAddress: validatorInfo?.address,
                gasUsed: '0',
                gasWanted: '0',
                transactions: [] // Fetch separately if needed
              };
              
              setBlock(formattedBlock);
              setLoading(false);
              return;
            } catch (directError) {
              console.warn('[BlockDetail] Direct LCD fetch failed, trying server API:', directError);
            }
          }
          
          // Fallback: Server API
          const res = await fetch(`/api/block?chain=${chainParam}&height=${params.height}`);
          
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          
          const data = await res.json();
          
          if (data.error) {
            console.error('Error loading block:', data.error);
            setBlock(null);
          } else {
            setBlock(data);
          }
          setLoading(false);
        } catch (err) {
          console.error('Error loading block:', err);
          setBlock(null);
          setLoading(false);
        }
      };
      
      fetchBlockData();
    }
  }, [selectedChain, params]);

  const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';

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
          <div className="mb-6">
            <div className="flex items-center text-sm text-gray-400 mb-4">
              <Link href={`/${chainPath}`} className="hover:text-white">{t('blockDetail.overview')}</Link>
              <span className="mx-2">/</span>
              <Link href={`/${chainPath}/blocks`} className="hover:text-white">{t('blockDetail.blocks')}</Link>
              <span className="mx-2">/</span>
              <span className="text-white">{params?.height}</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
              <Box className="w-8 h-8 mr-3" />
              {t('blockDetail.title')} #{params?.height}
            </h1>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-400">{t('blockDetail.loading')}</p>
            </div>
          ) : block ? (
            <div className="space-y-6">
              {/* Block Information */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">{t('blockDetail.blockInfo')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-start mb-4">
                      <Hash className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                      <div className="flex-1">
                        <p className="text-gray-400 text-sm mb-1">{t('blockDetail.blockHash')}</p>
                        <p className="text-white font-mono text-sm break-all">{block.hash}</p>
                      </div>
                    </div>
                    <div className="flex items-start mb-4">
                      <User className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                      <div className="flex-1">
                        <p className="text-gray-400 text-sm mb-1">{t('blockDetail.proposer')}</p>
                        {block.proposerMoniker ? (
                          <div className="flex items-center gap-3 mt-2">
                            <ValidatorAvatar 
                              identity={block.proposerIdentity}
                              moniker={block.proposerMoniker}
                              size="md"
                            />
                            <div>
                              <p className="text-white font-medium">{block.proposerMoniker}</p>
                              {block.proposerAddress && (
                                <Link 
                                  href={`/${chainPath}/validators/${block.proposerAddress}`}
                                  className="text-blue-400 hover:text-blue-300 text-xs font-mono"
                                >
                                  {block.proposerAddress.slice(0, 12)}...{block.proposerAddress.slice(-8)}
                                </Link>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-white font-mono text-sm break-all mt-2">
                            {block.proposer}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-start mb-4">
                      <Clock className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                      <div className="flex-1">
                        <p className="text-gray-400 text-sm mb-1">{t('blockDetail.timestamp')}</p>
                        <p className="text-white text-sm">
                          {block.time ? new Date(block.time).toLocaleString() : 'N/A'}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          {block.time && formatDistanceToNow(new Date(block.time), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start mb-4">
                      <FileText className="w-5 h-5 text-gray-400 mr-3 mt-1" />
                      <div className="flex-1">
                        <p className="text-gray-400 text-sm mb-1">{t('blockDetail.transactions')}</p>
                        <p className="text-white text-sm font-semibold">{block.txs}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-gray-800">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">{t('blockDetail.gasUsed')}</p>
                    <p className="text-white text-sm">{block.gasUsed || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">{t('blockDetail.gasWanted')}</p>
                    <p className="text-white text-sm">{block.gasWanted || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Transactions */}
              {block.transactions && block.transactions.length > 0 && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4">
                    {t('blockDetail.transactionsList')} ({block.transactions.length})
                  </h2>
                  <div className="space-y-3">
                    {block.transactions.map((tx, index) => (
                      <Link
                        key={index}
                        href={`/${chainPath}/transactions/${tx.hash}`}
                        className="block bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 hover:border-blue-500 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-blue-500 hover:text-blue-400 font-mono text-sm">
                            {tx.hash.slice(0, 16)}...{tx.hash.slice(-16)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            tx.result === 'Success' 
                              ? 'bg-green-500/10 text-green-500' 
                              : 'bg-red-500/10 text-red-500'
                          }`}>
                            {tx.result === 'Success' ? t('blockDetail.success') : t('blockDetail.failed')}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm">{t('blockDetail.type')}: {tx.type.split('.').pop()}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-500">{t('blockDetail.notFound')}</p>
            </div>
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

