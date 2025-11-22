'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { ChainData } from '@/types/chain';
import { formatDistanceToNow } from 'date-fns';
import { Box, Clock, Hash, User, FileText, Gauge, CheckCircle, XCircle, Copy, Check } from 'lucide-react';
import ValidatorAvatar from '@/components/ValidatorAvatar';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';

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
    types?: string[];
    messageCount?: number;
    result: string;
    gasUsed?: string;
    gasWanted?: string;
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
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedProposer, setCopiedProposer] = useState(false);

  const copyToClipboard = (text: string, type: 'hash' | 'proposer') => {
    navigator.clipboard.writeText(text);
    if (type === 'hash') {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 1500);
    } else {
      setCopiedProposer(true);
      setTimeout(() => setCopiedProposer(false), 1500);
    }
  };

  useEffect(() => {
    fetch('/api/chains')
      .then(res => res.json())
      .then(data => {
        setChains(data);
        const chainName = (params?.chain as string)?.trim();
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
      setBlock(null); // Reset block state
      const chainParam = selectedChain.chain_id || selectedChain.chain_name;
      console.log('Fetching block:', params.height, 'for chain:', chainParam);
      
      fetch(`/api/block?chain=${chainParam}&height=${params.height}`)
        .then(res => {
          console.log('Response status:', res.status);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          console.log('Block data received:', data);
          if (data.error) {
            console.error('Error loading block:', data.error);
            setBlock(null);
          } else {
            setBlock(data);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Error loading block:', err);
          setBlock(null);
          setLoading(false);
        });
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
              {/* Block Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm font-medium">Height</span>
                    <Box className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">#{block.height.toLocaleString()}</p>
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm font-medium">Transactions</span>
                    <FileText className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{block.txs}</p>
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm font-medium">Gas Used</span>
                    <Gauge className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xl font-bold text-white">{block.gasUsed !== 'N/A' ? parseInt(block.gasUsed).toLocaleString() : 'N/A'}</p>
                  {block.gasWanted !== 'N/A' && block.gasUsed !== 'N/A' && (
                    <p className="text-xs text-gray-400 mt-1">
                      {((parseInt(block.gasUsed) / parseInt(block.gasWanted)) * 100).toFixed(1)}% efficiency
                    </p>
                  )}
                </div>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm font-medium">Gas Wanted</span>
                    <Gauge className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-xl font-bold text-white">{block.gasWanted !== 'N/A' ? parseInt(block.gasWanted).toLocaleString() : 'N/A'}</p>
                </div>
              </div>

              {/* Block Information */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                  <Hash className="w-5 h-5 mr-2" />
                  {t('blockDetail.blockInfo')}
                </h2>
                <div className="space-y-6">
                  {/* Block Hash */}
                  <div className="bg-[#0f0f0f] rounded-lg p-4 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-400 text-sm font-medium">{t('blockDetail.blockHash')}</p>
                      <button
                        onClick={() => copyToClipboard(block.hash, 'hash')}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
                      >
                        {copiedHash ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-xs text-gray-400">{copiedHash ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                    <p className="text-white font-mono text-sm break-all">{block.hash}</p>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-start">
                    <Clock className="w-5 h-5 text-gray-400 mr-3 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-gray-400 text-sm mb-1">{t('blockDetail.timestamp')}</p>
                      <p className="text-white font-medium">
                        {block.time ? new Date(block.time).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          timeZoneName: 'short'
                        }) : 'N/A'}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        {block.time && formatDistanceToNow(new Date(block.time), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {/* Proposer */}
                  <div className="bg-[#0f0f0f] rounded-lg p-4 border border-gray-800">
                    <div className="flex items-start">
                      <User className="w-5 h-5 text-gray-400 mr-3 mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-gray-400 text-sm mb-3">{t('blockDetail.proposer')}</p>
                        {block.proposerMoniker ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <ValidatorAvatar 
                                identity={block.proposerIdentity}
                                moniker={block.proposerMoniker}
                                size="lg"
                              />
                              <div>
                                <p className="text-white font-semibold text-lg">{block.proposerMoniker}</p>
                                {block.proposerIdentity && (
                                  <p className="text-gray-500 text-xs font-mono mt-0.5">Keybase: {block.proposerIdentity}</p>
                                )}
                              </div>
                            </div>
                            {block.proposerAddress && (
                              <div className="flex items-center justify-between bg-[#1a1a1a] rounded px-3 py-2 border border-gray-800">
                                <Link 
                                  href={`/${chainPath}/validators/${block.proposerAddress}`}
                                  className="text-blue-400 hover:text-blue-300 text-sm font-mono"
                                >
                                  {block.proposerAddress}
                                </Link>
                                <button
                                  onClick={() => copyToClipboard(block.proposerAddress!, 'proposer')}
                                  className="ml-2 p-1 rounded hover:bg-gray-700 transition-colors"
                                >
                                  {copiedProposer ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Copy className="w-4 h-4 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-white font-mono text-sm break-all mt-2">
                            {block.proposer}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions */}
              {block.transactions && block.transactions.length > 0 && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-between">
                    <span className="flex items-center">
                      <FileText className="w-5 h-5 mr-2" />
                      {t('blockDetail.transactionsList')}
                    </span>
                    <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm font-medium">
                      {block.transactions.length} {block.transactions.length === 1 ? 'Transaction' : 'Transactions'}
                    </span>
                  </h2>
                  <div className="space-y-3">
                    {block.transactions.map((tx, index) => (
                      <Link
                        key={index}
                        href={`/${chainPath}/transactions/${tx.hash}`}
                        className="block bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-gray-500 font-medium">#{index + 1}</span>
                              <span className="text-gray-300 hover:text-white font-mono text-sm truncate">
                                {tx.hash}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-xs text-gray-500">Messages:</span>
                              {tx.types && tx.types.length > 0 ? (
                                tx.types.map((type, i) => (
                                  <span key={i} className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded">
                                    {type}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded">
                                  {tx.type}
                                </span>
                              )}
                              {tx.messageCount && tx.messageCount > 1 && (
                                <span className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded">
                                  {tx.messageCount} messages
                                </span>
                              )}
                            </div>
                            {(tx.gasUsed || tx.gasWanted) && (
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                {tx.gasUsed && (
                                  <span>Gas Used: <span className="text-gray-300">{parseInt(tx.gasUsed).toLocaleString()}</span></span>
                                )}
                                {tx.gasWanted && (
                                  <span>Gas Wanted: <span className="text-gray-300">{parseInt(tx.gasWanted).toLocaleString()}</span></span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            {tx.result === 'Success' ? (
                              <div className="flex items-center gap-1 bg-green-500/10 text-green-500 px-3 py-1.5 rounded-full">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-xs font-medium">{t('blockDetail.success')}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-red-500/10 text-red-500 px-3 py-1.5 rounded-full">
                                <XCircle className="w-4 h-4" />
                                <span className="text-xs font-medium">{t('blockDetail.failed')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State for No Transactions */}
              {block.txs === 0 && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-12 text-center">
                  <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No transactions in this block</p>
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

