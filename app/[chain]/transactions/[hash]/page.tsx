'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { ChainData } from '@/types/chain';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Hash, Clock, CheckCircle, XCircle, DollarSign, Code, Zap, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';

interface TxDetail {
  hash: string;
  height: number;
  time: string;
  result: string;
  code: number;
  gasUsed: string;
  gasWanted: string;
  fee: string;
  memo: string;
  messages: Array<{
    type: string;
    value: any;
  }>;
  events?: Array<any>;
  logs: string;
  rawLog: string;
}

export default function TransactionDetailPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [transaction, setTransaction] = useState<TxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'logs' | 'raw'>('overview');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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
    if (selectedChain && params?.hash) {
      setLoading(true);
      fetch(`/api/transaction?chain=${selectedChain.chain_id || selectedChain.chain_name}&hash=${params.hash}`)
        .then(res => {
          if (!res.ok) {
            throw new Error('Transaction not found');
          }
          return res.json();
        })
        .then(data => {
          const transformedData: TxDetail = {
            hash: data.hash,
            height: data.height,
            time: data.time,
            result: data.code === 0 ? 'Success' : 'Failed',
            code: data.code || 0,
            gasUsed: data.gasUsed,
            gasWanted: data.gasWanted,
            fee: data.fee,
            memo: data.memo || '',
            messages: data.messages.map((msg: any) => ({
              type: msg['@type'] || msg.type || 'Unknown',
              value: msg
            })),
            logs: data.rawLog || JSON.stringify(data.events || data.logs, null, 2),
            rawLog: data.rawLog || JSON.stringify(data.events || [], null, 2)
          };
          setTransaction(transformedData);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error loading transaction:', err);
          setLoading(false);
        });
    }
  }, [selectedChain, params]);

  const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';
  const asset = selectedChain?.assets[0];

  const formatFee = (fee: string) => {
    if (!asset) return fee;
    const feeNum = parseFloat(fee) / Math.pow(10, Number(asset.exponent));
    return `${feeNum.toFixed(6)} ${asset.symbol}`;
  };

  const getTransferInfo = (msg: any) => {
    const msgType = msg.type;
    const msgValue = msg.value;

    // Extract message type name (last part of path)
    const typeName = msgType.split('.').pop() || msgType;

    // If message is Unknown (from RPC), try to parse from rawLog/events
    if (typeName === 'Unknown' && transaction) {
      return parseFromEvents();
    }

    // Extract transfer details from message value
    if (typeName.includes('MsgSend') || typeName.includes('MsgTransfer')) {
      return {
        from: msgValue.from_address || msgValue.sender,
        to: msgValue.to_address || msgValue.receiver,
        amount: msgValue.amount?.[0] || msgValue.token,
        type: 'Transfer'
      };
    } else if (typeName.includes('MsgDelegate') && !typeName.includes('Undelegate')) {
      return {
        from: msgValue.delegator_address,
        to: msgValue.validator_address,
        amount: msgValue.amount,
        type: 'Delegate'
      };
    } else if (typeName.includes('MsgUndelegate')) {
      return {
        from: msgValue.delegator_address,
        to: msgValue.validator_address,
        amount: msgValue.amount,
        type: 'Undelegate'
      };
    } else if (typeName.includes('MsgBeginRedelegate')) {
      return {
        from: msgValue.validator_src_address,
        to: msgValue.validator_dst_address,
        amount: msgValue.amount,
        type: 'Redelegate',
        delegator: msgValue.delegator_address
      };
    } else if (typeName.includes('MsgWithdrawDelegatorReward') || typeName.includes('MsgWithdrawReward')) {
      return {
        from: msgValue.validator_address,
        to: msgValue.delegator_address,
        type: 'Withdraw Rewards'
      };
    }
    return null;
  };

  const parseFromEvents = () => {
    if (!transaction || !transaction.rawLog) return null;

    try {
      const logData = JSON.parse(transaction.rawLog);
      if (!logData[0]?.events) return null;

      const events = logData[0].events;
      
      // Check for delegate event
      const delegateEvent = events.find((e: any) => e.type === 'delegate');
      if (delegateEvent) {
        const validator = delegateEvent.attributes.find((a: any) => a.key === 'validator')?.value;
        const delegator = delegateEvent.attributes.find((a: any) => a.key === 'delegator')?.value;
        const amount = delegateEvent.attributes.find((a: any) => a.key === 'amount')?.value;
        
        if (validator && delegator && amount) {
          return {
            from: delegator,
            to: validator,
            amount: { amount: amount.replace(/[^0-9]/g, '') },
            type: 'Delegate'
          };
        }
      }

      // Check for transfer event
      const transferEvent = events.find((e: any) => e.type === 'transfer');
      if (transferEvent) {
        const recipient = transferEvent.attributes.find((a: any) => a.key === 'recipient')?.value;
        const sender = transferEvent.attributes.find((a: any) => a.key === 'sender')?.value;
        const amount = transferEvent.attributes.find((a: any) => a.key === 'amount')?.value;
        
        if (recipient && sender && amount) {
          return {
            from: sender,
            to: recipient,
            amount: { amount: amount.replace(/[^0-9]/g, '') },
            type: 'Transfer'
          };
        }
      }

      // Check for withdraw_rewards event
      const withdrawEvent = events.find((e: any) => e.type === 'withdraw_rewards');
      if (withdrawEvent) {
        const validator = withdrawEvent.attributes.find((a: any) => a.key === 'validator')?.value;
        const delegator = withdrawEvent.attributes.find((a: any) => a.key === 'delegator')?.value;
        const amount = withdrawEvent.attributes.find((a: any) => a.key === 'amount')?.value;
        
        return {
          from: validator,
          to: delegator,
          amount: amount ? { amount: amount.replace(/[^0-9]/g, '') } : null,
          type: 'Withdraw Rewards'
        };
      }
    } catch (e) {
      console.error('Error parsing events:', e);
    }

    return null;
  };

  const formatAmount = (amount: any) => {
    if (!amount || !asset) return 'N/A';
    
    let value = '0';
    if (typeof amount === 'string') {
      value = amount;
    } else if (amount.amount) {
      value = amount.amount;
    } else if (amount.value) {
      value = amount.value;
    }
    
    const num = parseFloat(value) / Math.pow(10, Number(asset.exponent));
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${asset.symbol}`;
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
          <div className="mb-6">
            <div className="flex items-center text-sm text-gray-400 mb-4">
              <Link href={`/${chainPath}`} className="hover:text-white">{t('txDetail.overview')}</Link>
              <span className="mx-2">/</span>
              <Link href={`/${chainPath}/transactions`} className="hover:text-white">{t('txDetail.transactions')}</Link>
              <span className="mx-2">/</span>
              <span className="text-white">{params?.hash ? `${(params.hash as string).slice(0, 8)}...` : ''}</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
              <FileText className="w-8 h-8 mr-3" />
              {t('txDetail.title')}
            </h1>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-400">{t('txDetail.loading')}</p>
            </div>
          ) : transaction ? (
            <div className="space-y-6">
              {/* Transaction Status */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-2">{t('txDetail.status')}</p>
                    <div className="flex items-center gap-2">
                      {transaction.result === 'Success' ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-green-500" />
                          <span className="text-2xl font-bold text-green-500">{t('txDetail.success')}</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-6 h-6 text-red-500" />
                          <span className="text-2xl font-bold text-red-500">{t('txDetail.failed')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-sm mb-2">{t('txDetail.code')}</p>
                    <p className="text-2xl font-bold text-white">{transaction.code}</p>
                  </div>
                </div>
              </div>

              {/* Transaction Info */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-bold text-white mb-4">{t('txDetail.txInfo')}</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-gray-400" />
                          <p className="text-gray-400 text-sm font-semibold">{t('txDetail.txHash')}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(transaction.hash, 'hash')}
                          className="p-1.5 hover:bg-gray-800 rounded transition-colors"
                          title="Copy hash"
                        >
                          {copiedField === 'hash' ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <p className="text-white font-mono text-sm break-all">{transaction.hash}</p>
                    </div>

                    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <p className="text-gray-400 text-sm font-semibold">{t('txDetail.timestamp')}</p>
                      </div>
                      <p className="text-white text-sm">
                        {new Date(transaction.time).toLocaleString()}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {formatDistanceToNow(new Date(transaction.time), { addSuffix: true })}
                      </p>
                    </div>

                    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <p className="text-gray-400 text-sm font-semibold">{t('txDetail.txFee')}</p>
                      </div>
                      <p className="text-white text-lg font-bold">{formatFee(transaction.fee)}</p>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <p className="text-gray-400 text-sm font-semibold">{t('txDetail.blockHeight')}</p>
                      </div>
                      <Link 
                        href={`/${chainPath}/blocks/${transaction.height}`}
                        className="text-blue-500 hover:text-blue-400 text-lg font-bold"
                      >
                        #{transaction.height.toLocaleString()}
                      </Link>
                    </div>

                    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-gray-400" />
                        <p className="text-gray-400 text-sm font-semibold">{t('txDetail.gasUsage')}</p>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-white text-lg font-bold">
                          {parseInt(transaction.gasUsed).toLocaleString()}
                        </p>
                        <p className="text-gray-400 text-sm">
                          / {parseInt(transaction.gasWanted).toLocaleString()}
                        </p>
                      </div>
                      <div className="mt-2 bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full rounded-full"
                          style={{ width: `${(parseFloat(transaction.gasUsed) / parseFloat(transaction.gasWanted)) * 100}%` }}
                        />
                      </div>
                      <p className="text-gray-500 text-xs mt-1">
                        {((parseFloat(transaction.gasUsed) / parseFloat(transaction.gasWanted)) * 100).toFixed(2)}% {t('txDetail.efficiency')}
                      </p>
                    </div>

                    {transaction.memo && (
                      <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <p className="text-gray-400 text-sm font-semibold">{t('txDetail.memo')}</p>
                        </div>
                        <p className="text-white text-sm break-words">{transaction.memo}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transaction Actions */}
                {transaction.messages.some(msg => getTransferInfo(msg)) && (
                  <div className="mt-6 pt-6 border-t border-gray-700">
                    <h3 className="text-lg font-bold text-white mb-4">Transaction Actions</h3>
                    <div className="space-y-3">
                      {transaction.messages.map((msg, idx) => {
                        const transferInfo = getTransferInfo(msg);
                        if (!transferInfo) return null;

                        return (
                          <div key={idx} className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                <span className="text-xl">
                                  {transferInfo.type === 'Transfer' && '💸'}
                                  {transferInfo.type === 'Delegate' && '🔗'}
                                  {transferInfo.type === 'Undelegate' && '🔓'}
                                  {transferInfo.type === 'Redelegate' && '🔄'}
                                  {transferInfo.type === 'Withdraw Rewards' && '💰'}
                                </span>
                              </div>
                              <div className="flex-1">
                                <p className="text-white font-semibold">{transferInfo.type}</p>
                                <p className="text-gray-400 text-xs">{msg.type.split('.').pop()}</p>
                              </div>
                            </div>

                            <div className="space-y-2 text-sm">
                              {transferInfo.delegator && (
                                <div className="flex items-start gap-2">
                                  <span className="text-gray-400 min-w-[80px]">Delegator:</span>
                                  <div className="flex-1 flex items-center gap-2">
                                    <span className="text-blue-400 font-mono break-all">{transferInfo.delegator}</span>
                                    <button
                                      onClick={() => copyToClipboard(transferInfo.delegator, `delegator-${idx}`)}
                                      className="p-1 hover:bg-gray-800 rounded"
                                    >
                                      {copiedField === `delegator-${idx}` ? (
                                        <Check className="w-3 h-3 text-green-500" />
                                      ) : (
                                        <Copy className="w-3 h-3 text-gray-400" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex items-start gap-2">
                                <span className="text-gray-400 min-w-[80px]">From:</span>
                                <div className="flex-1 flex items-center gap-2">
                                  <span className="text-white font-mono break-all">{transferInfo.from}</span>
                                  <button
                                    onClick={() => copyToClipboard(transferInfo.from, `from-${idx}`)}
                                    className="p-1 hover:bg-gray-800 rounded"
                                  >
                                    {copiedField === `from-${idx}` ? (
                                      <Check className="w-3 h-3 text-green-500" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-gray-400" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 text-gray-500 pl-[88px]">
                                <span>→</span>
                              </div>

                              <div className="flex items-start gap-2">
                                <span className="text-gray-400 min-w-[80px]">To:</span>
                                <div className="flex-1 flex items-center gap-2">
                                  <span className="text-white font-mono break-all">{transferInfo.to}</span>
                                  <button
                                    onClick={() => copyToClipboard(transferInfo.to, `to-${idx}`)}
                                    className="p-1 hover:bg-gray-800 rounded"
                                  >
                                    {copiedField === `to-${idx}` ? (
                                      <Check className="w-3 h-3 text-green-500" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-gray-400" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              {transferInfo.amount && (
                                <div className="flex items-start gap-2 pt-2 border-t border-gray-700">
                                  <span className="text-gray-400 min-w-[80px]">Amount:</span>
                                  <div className="flex-1 flex items-center gap-2">
                                    <span className="text-green-400 font-bold text-lg">{formatAmount(transferInfo.amount)}</span>
                                    <button
                                      onClick={() => copyToClipboard(formatAmount(transferInfo.amount), `amount-${idx}`)}
                                      className="p-1 hover:bg-gray-800 rounded"
                                    >
                                      {copiedField === `amount-${idx}` ? (
                                        <Check className="w-3 h-3 text-green-500" />
                                      ) : (
                                        <Copy className="w-3 h-3 text-gray-400" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                <div className="flex border-b border-gray-800">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-6 py-3 font-medium transition-colors ${
                      activeTab === 'overview'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {t('txDetail.tabOverview')}
                  </button>
                  <button
                    onClick={() => setActiveTab('messages')}
                    className={`px-6 py-3 font-medium transition-colors ${
                      activeTab === 'messages'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {t('txDetail.tabMessages')} ({transaction.messages.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('raw')}
                    className={`px-6 py-3 font-medium transition-colors ${
                      activeTab === 'raw'
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {t('txDetail.tabRaw')}
                  </button>
                </div>

                <div className="p-6">
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-4">{t('txDetail.summary')}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                            <p className="text-gray-400 text-sm mb-1">Messages</p>
                            <p className="text-white font-semibold text-2xl">{transaction.messages.length}</p>
                          </div>
                          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                            <p className="text-gray-400 text-sm mb-1">Gas Efficiency</p>
                            <p className="text-white font-semibold text-2xl">
                              {((parseFloat(transaction.gasUsed) / parseFloat(transaction.gasWanted)) * 100).toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Additional Overview Info */}
                      <div>
                        <h3 className="text-lg font-bold text-white mb-4">Transaction Events</h3>
                        <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                          <p className="text-gray-400 text-sm mb-1">Total Events</p>
                          <p className="text-white font-semibold text-2xl">{transaction.events?.length || 0}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'messages' && (
                    <div className="space-y-4">
                      {transaction.messages.map((msg, idx) => {
                        const msgValue = msg.value;
                        const msgType = msg.type;
                        
                        return (
                          <div key={idx} className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Code className="w-5 h-5 text-blue-400" />
                              <span className="text-sm font-semibold text-blue-400">
                                {t('txDetail.message')} #{idx + 1}: {msgType}
                              </span>
                            </div>
                            
                            {/* Display key message fields in a readable format */}
                            <div className="space-y-3 mb-4">
                              {/* Delegate Message */}
                              {msgType === 'MsgDelegate' && msgValue.delegator_address && msgValue.validator_address && msgValue.amount && (
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                                      <span className="text-blue-400 text-xl">🔗</span>
                                    </div>
                                    <div>
                                      <p className="text-blue-400 font-semibold">Delegation</p>
                                      <p className="text-gray-400 text-xs">Staking tokens to validator</p>
                                    </div>
                                  </div>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-2">
                                      <span className="text-gray-400 min-w-[80px]">Delegator:</span>
                                      <Link 
                                        href={`/${chainPath}/accounts/${msgValue.delegator_address}`}
                                        className="text-blue-400 hover:text-blue-300 font-mono break-all"
                                      >
                                        {msgValue.delegator_address}
                                      </Link>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-400 pl-[88px]">
                                      <span>↓</span>
                                      <span className="text-xs">delegates to</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="text-gray-400 min-w-[80px]">Validator:</span>
                                      <Link 
                                        href={`/${chainPath}/validators/${msgValue.validator_address}`}
                                        className="text-blue-400 hover:text-blue-300 font-mono break-all"
                                      >
                                        {msgValue.validator_address}
                                      </Link>
                                    </div>
                                    <div className="flex items-start gap-2 pt-2 border-t border-blue-500/30">
                                      <span className="text-gray-400 min-w-[80px]">Amount:</span>
                                      <span className="text-green-400 font-bold text-lg">
                                        {(parseInt(msgValue.amount.amount) / 1000000).toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset?.symbol}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Undelegate Message */}
                              {msgType === 'MsgUndelegate' && msgValue.delegator_address && msgValue.validator_address && msgValue.amount && (
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                                      <span className="text-orange-400 text-xl">🔓</span>
                                    </div>
                                    <div>
                                      <p className="text-orange-400 font-semibold">Undelegation</p>
                                      <p className="text-gray-400 text-xs">Unstaking tokens from validator</p>
                                    </div>
                                  </div>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-2">
                                      <span className="text-gray-400 min-w-[80px]">Delegator:</span>
                                      <Link 
                                        href={`/${chainPath}/accounts/${msgValue.delegator_address}`}
                                        className="text-orange-400 hover:text-orange-300 font-mono break-all"
                                      >
                                        {msgValue.delegator_address}
                                      </Link>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-400 pl-[88px]">
                                      <span>↑</span>
                                      <span className="text-xs">undelegates from</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="text-gray-400 min-w-[80px]">Validator:</span>
                                      <Link 
                                        href={`/${chainPath}/validators/${msgValue.validator_address}`}
                                        className="text-orange-400 hover:text-orange-300 font-mono break-all"
                                      >
                                        {msgValue.validator_address}
                                      </Link>
                                    </div>
                                    <div className="flex items-start gap-2 pt-2 border-t border-orange-500/30">
                                      <span className="text-gray-400 min-w-[80px]">Amount:</span>
                                      <span className="text-orange-400 font-bold text-lg">
                                        {(parseInt(msgValue.amount.amount) / 1000000).toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset?.symbol}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Redelegate Message */}
                              {msgType === 'MsgBeginRedelegate' && msgValue.delegator_address && msgValue.validator_src_address && msgValue.validator_dst_address && msgValue.amount && (
                                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                                      <span className="text-purple-400 text-xl">🔄</span>
                                    </div>
                                    <div>
                                      <p className="text-purple-400 font-semibold">Redelegation</p>
                                      <p className="text-gray-400 text-xs">Moving stake between validators</p>
                                    </div>
                                  </div>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-2">
                                      <span className="text-gray-400 min-w-[80px]">Delegator:</span>
                                      <Link 
                                        href={`/${chainPath}/accounts/${msgValue.delegator_address}`}
                                        className="text-purple-400 hover:text-purple-300 font-mono break-all"
                                      >
                                        {msgValue.delegator_address}
                                      </Link>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="text-gray-400 min-w-[80px]">From:</span>
                                      <Link 
                                        href={`/${chainPath}/validators/${msgValue.validator_src_address}`}
                                        className="text-purple-400 hover:text-purple-300 font-mono break-all"
                                      >
                                        {msgValue.validator_src_address}
                                      </Link>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-400 pl-[88px]">
                                      <span>→</span>
                                      <span className="text-xs">redirects to</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="text-gray-400 min-w-[80px]">To:</span>
                                      <Link 
                                        href={`/${chainPath}/validators/${msgValue.validator_dst_address}`}
                                        className="text-purple-400 hover:text-purple-300 font-mono break-all"
                                      >
                                        {msgValue.validator_dst_address}
                                      </Link>
                                    </div>
                                    <div className="flex items-start gap-2 pt-2 border-t border-purple-500/30">
                                      <span className="text-gray-400 min-w-[80px]">Amount:</span>
                                      <span className="text-purple-400 font-bold text-lg">
                                        {(parseInt(msgValue.amount.amount) / 1000000).toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset?.symbol}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Send/Transfer Message */}
                              {(msgType === 'MsgSend' || msgType === 'MsgTransfer') && (
                                (() => {
                                  const fromAddr = msgValue.from_address || msgValue.sender;
                                  const toAddr = msgValue.to_address || msgValue.receiver;
                                  
                                  if (!fromAddr || !toAddr) return null;
                                  
                                  return (
                                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                                          <span className="text-green-400 text-xl">💸</span>
                                        </div>
                                        <div>
                                          <p className="text-green-400 font-semibold">Transfer</p>
                                          <p className="text-gray-400 text-xs">Sending tokens</p>
                                        </div>
                                      </div>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex items-start gap-2">
                                          <span className="text-gray-400 min-w-[80px]">From:</span>
                                          <Link 
                                            href={`/${chainPath}/accounts/${fromAddr}`}
                                            className="text-green-400 hover:text-green-300 font-mono break-all"
                                          >
                                            {fromAddr}
                                          </Link>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-400 pl-[88px]">
                                          <span>→</span>
                                          <span className="text-xs">sends to</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                          <span className="text-gray-400 min-w-[80px]">To:</span>
                                          <Link 
                                            href={`/${chainPath}/accounts/${toAddr}`}
                                            className="text-green-400 hover:text-green-300 font-mono break-all"
                                          >
                                            {toAddr}
                                          </Link>
                                        </div>
                                        {msgValue.amount && Array.isArray(msgValue.amount) && msgValue.amount.length > 0 && (
                                          <div className="flex items-start gap-2 pt-2 border-t border-green-500/30">
                                            <span className="text-gray-400 min-w-[80px]">Amount:</span>
                                            <div className="space-y-1">
                                              {msgValue.amount.map((amt: any, i: number) => (
                                                <p key={i} className="text-green-400 font-bold text-lg">
                                                  {(parseInt(amt.amount) / 1000000).toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset?.symbol}
                                                </p>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()
                              )}

                              {/* Vote Message */}
                              {msgType === 'MsgVote' && msgValue.voter && msgValue.proposal_id && (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                                      <span className="text-yellow-400 text-xl">🗳️</span>
                                    </div>
                                    <div>
                                      <p className="text-yellow-400 font-semibold">Vote</p>
                                      <p className="text-gray-400 text-xs">Governance vote</p>
                                    </div>
                                  </div>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-start gap-2">
                                      <span className="text-gray-400 min-w-[80px]">Voter:</span>
                                      <Link 
                                        href={`/${chainPath}/accounts/${msgValue.voter}`}
                                        className="text-yellow-400 hover:text-yellow-300 font-mono break-all"
                                      >
                                        {msgValue.voter}
                                      </Link>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="text-gray-400 min-w-[80px]">Proposal:</span>
                                      <Link 
                                        href={`/${chainPath}/proposals/${msgValue.proposal_id}`}
                                        className="text-yellow-400 hover:text-yellow-300 font-mono"
                                      >
                                        #{msgValue.proposal_id}
                                      </Link>
                                    </div>
                                    {msgValue.option && (
                                      <div className="flex items-start gap-2 pt-2 border-t border-yellow-500/30">
                                        <span className="text-gray-400 min-w-[80px]">Option:</span>
                                        <span className="inline-block px-3 py-1 rounded-full text-sm bg-yellow-500/20 text-yellow-400 font-semibold">
                                          {msgValue.option.replace('VOTE_OPTION_', '')}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Generic fallback for other message types */}
                              {msgType !== 'MsgDelegate' && 
                               msgType !== 'MsgUndelegate' && 
                               msgType !== 'MsgBeginRedelegate' && 
                               msgType !== 'MsgSend' && 
                               msgType !== 'MsgTransfer' && 
                               msgType !== 'MsgVote' && (
                                <>
                                  {msgValue.from_address && (
                                    <div>
                                      <p className="text-gray-400 text-sm mb-1">From:</p>
                                      <Link 
                                        href={`/${chainPath}/accounts/${msgValue.from_address}`}
                                        className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
                                      >
                                        {msgValue.from_address}
                                      </Link>
                                    </div>
                                  )}
                                  
                                  {msgValue.to_address && (
                                    <div>
                                      <p className="text-gray-400 text-sm mb-1">To:</p>
                                      <Link 
                                        href={`/${chainPath}/accounts/${msgValue.to_address}`}
                                        className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
                                      >
                                        {msgValue.to_address}
                                      </Link>
                                    </div>
                                  )}
                                  
                                  {msgValue.delegator_address && (
                                    <div>
                                      <p className="text-gray-400 text-sm mb-1">Delegator:</p>
                                      <Link 
                                        href={`/${chainPath}/accounts/${msgValue.delegator_address}`}
                                        className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
                                      >
                                        {msgValue.delegator_address}
                                      </Link>
                                    </div>
                                  )}
                                  
                                  {msgValue.validator_address && (
                                    <div>
                                      <p className="text-gray-400 text-sm mb-1">Validator:</p>
                                      <Link 
                                        href={`/${chainPath}/validators/${msgValue.validator_address}`}
                                        className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
                                      >
                                        {msgValue.validator_address}
                                      </Link>
                                    </div>
                                  )}
                                  
                                  {msgValue.amount && Array.isArray(msgValue.amount) && msgValue.amount.length > 0 && (
                                    <div>
                                      <p className="text-gray-400 text-sm mb-1">Amount:</p>
                                      <div className="space-y-1">
                                        {msgValue.amount.map((amt: any, i: number) => (
                                          <p key={i} className="text-white font-semibold">
                                            {(parseInt(amt.amount) / 1000000).toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset?.symbol}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {msgValue.voter && (
                                    <div>
                                      <p className="text-gray-400 text-sm mb-1">Voter:</p>
                                      <Link 
                                        href={`/${chainPath}/accounts/${msgValue.voter}`}
                                        className="text-blue-400 hover:text-blue-300 font-mono text-sm break-all"
                                      >
                                        {msgValue.voter}
                                      </Link>
                                    </div>
                                  )}
                                  
                                  {msgValue.proposal_id && (
                                    <div>
                                      <p className="text-gray-400 text-sm mb-1">Proposal ID:</p>
                                      <Link 
                                        href={`/${chainPath}/proposals/${msgValue.proposal_id}`}
                                        className="text-blue-400 hover:text-blue-300 font-mono text-sm"
                                      >
                                        #{msgValue.proposal_id}
                                      </Link>
                                    </div>
                                  )}
                                  
                                  {msgValue.option && (
                                    <div>
                                      <p className="text-gray-400 text-sm mb-1">Vote Option:</p>
                                      <span className="inline-block px-3 py-1 rounded-full text-sm bg-blue-500/20 text-blue-400">
                                        {msgValue.option}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            
                            {/* Full JSON data in collapsible section */}
                            <details className="mt-4">
                              <summary className="text-gray-400 text-sm cursor-pointer hover:text-white">
                                Show full message data
                              </summary>
                              <pre className="bg-black p-3 rounded text-xs text-gray-300 overflow-x-auto mt-2">
                                {JSON.stringify(msgValue, null, 2)}
                              </pre>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeTab === 'raw' && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-white">Raw Transaction Data</h3>
                        <button
                          onClick={() => copyToClipboard(transaction.rawLog || '', 'rawLog')}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors"
                        >
                          {copiedField === 'rawLog' ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span className="text-sm">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span className="text-sm">Copy Raw Data</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="bg-black p-4 rounded text-xs text-gray-300 overflow-x-auto">
                        {transaction.rawLog || 'No raw data available'}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-500">{t('txDetail.notFound')}</p>
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

