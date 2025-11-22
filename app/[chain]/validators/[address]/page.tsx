'use client';

import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { ChainData } from '@/types/chain';
import { ArrowLeft, Shield, TrendingUp, Users, Award, Clock, DollarSign, FileText } from 'lucide-react';
import ValidatorAvatar from '@/components/ValidatorAvatar';
import { getCacheKey, setCache, getStaleCache } from '@/lib/cacheUtils';
import { fetchApi } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { convertValidatorToAccountAddress } from '@/lib/addressConverter';

interface ValidatorDetail {
  address: string;
  accountAddress?: string;
  moniker: string;
  website: string;
  details: string;
  identity: string;
  votingPower: string;
  votingPowerPercentage: string;
  commission: string;
  maxCommission: string;
  maxChangeRate: string;
  status: string;
  jailed: boolean;
  tokens: string;
  delegatorShares: string;
  unbondingHeight: string;
  unbondingTime: string;
}

interface Delegation {
  delegator: string;
  shares: string;
  balance: string;
}

interface UnbondingDelegation {
  delegator: string;
  entries: Array<{
    balance: string;
    completionTime: string;
  }>;
}

interface ValidatorTransaction {
  hash: string;
  type: string;
  height: number;
  time: string;
  result: string;
}

export default function ValidatorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [validator, setValidator] = useState<ValidatorDetail | null>(null);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [unbondingDelegations, setUnbondingDelegations] = useState<UnbondingDelegation[]>([]);
  const [transactions, setTransactions] = useState<ValidatorTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'delegations' | 'unbonding' | 'transactions'>('delegations');
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [stakeTab, setStakeTab] = useState<'delegate' | 'undelegate' | 'redelegate' | 'withdraw'>('delegate');
  const [stakeAmount, setStakeAmount] = useState('');
  const [stakePercentage, setStakePercentage] = useState(0);

  const chainPath = useMemo(() => 
    selectedChain ? selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-') : '',
    [selectedChain]
  );

  useEffect(() => {
    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = (params?.chain as string)?.trim();
      const chain = chainName 
        ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
        : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
      if (chain) setSelectedChain(chain);
    } else {
      fetchApi('/api/chains')
        .then(res => res.json())
        .then(data => {
          sessionStorage.setItem('chains', JSON.stringify(data));
          setChains(data);
          const chainName = (params?.chain as string)?.trim();
          const chain = chainName 
            ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
            : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
          if (chain) setSelectedChain(chain);
        });
    }
  }, [params]);

  const fetchValidatorData = useCallback(async (showLoading = true) => {
    if (!selectedChain || !params?.address) return;
    
    const validatorCacheKey = getCacheKey('validator', selectedChain.chain_name, params.address as string);
    const cachedValidator = getStaleCache<ValidatorDetail>(validatorCacheKey);
    
    if (cachedValidator) {
      setValidator(cachedValidator);
      setLoading(false);
    }
    
    if (showLoading && !cachedValidator) setLoading(true);
    else setIsRefreshing(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let accountAddress = validator?.accountAddress;
      if (!accountAddress && params.address) {
        accountAddress = convertValidatorToAccountAddress(params.address as string);
      }
      
      const [validatorRes, delegationsRes, txRes] = await Promise.allSettled([
        fetchApi(`/api/validator?chain=${selectedChain.chain_id || selectedChain.chain_name}&address=${params.address}`, { 
          signal: controller.signal 
        }),
        fetchApi(`/api/validator/delegations?chain=${selectedChain.chain_name}&address=${params.address}`, { 
          signal: controller.signal 
        }),

        fetchApi(`/api/validator/transactions?chain=${selectedChain.chain_name}&address=${accountAddress || params.address}&limit=1000`, { 
          signal: controller.signal 
        })
      ]);
      
      clearTimeout(timeoutId);
      
      if (validatorRes.status === 'fulfilled' && validatorRes.value.ok) {
        const validatorData = await validatorRes.value.json();
        if (!validatorData.error) {
          setValidator(validatorData);
          setCache(validatorCacheKey, validatorData);
        } else if (!cachedValidator) {
          setValidator(null);
        }
      } else if (!cachedValidator) {
        setValidator(null);
      }
      
      if (delegationsRes.status === 'fulfilled' && delegationsRes.value.ok) {
        const delegationsData = await delegationsRes.value.json();
        setDelegations(delegationsData.delegations || []);
        setUnbondingDelegations(delegationsData.unbonding || []);
      }
      
      if (txRes.status === 'fulfilled' && txRes.value.ok) {
        const txData = await txRes.value.json();

        setTransactions(Array.isArray(txData) ? txData : (txData.transactions || []));
      }
    } catch (err) {
      if (!cachedValidator && !validator) {
        setValidator(null);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedChain, params]);

  useEffect(() => {
    fetchValidatorData(true);
  }, [fetchValidatorData]);

  useEffect(() => {
    if (!selectedChain || !params?.address) return;
    
    const interval = setInterval(() => {
      fetchValidatorData(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedChain, params, fetchValidatorData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <Sidebar selectedChain={selectedChain} />
        <div className="flex-1 flex flex-col">
          <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />
          <main className="flex-1 mt-16 p-6 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/20 border-t-blue-500"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/10 animate-pulse"></div>
              </div>
              <p className="text-gray-400 text-sm">{t('validatorDetail.loading')}</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!validator) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex">
        <Sidebar selectedChain={selectedChain} />
        <div className="flex-1 flex flex-col">
          <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />
          <main className="flex-1 mt-16 p-6 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">{t('validatorDetail.notFound')}</h2>
              <button 
                onClick={() => router.back()} 
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {t('validatorDetail.goBack')}
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-16 p-6 overflow-auto scroll-smooth">
          {/* Header Section */}
          <div className="mb-6 flex items-center justify-between animate-fade-in">
            <div>
              <div className="flex items-center text-sm text-gray-400 mb-2">
                <Link href={`/${chainPath}`} className="hover:text-blue-500 transition-all duration-200">{t('validatorDetail.overview')}</Link>
                <span className="mx-2">/</span>
                <Link href={`/${chainPath}/validators`} className="hover:text-blue-500 transition-all duration-200">{t('validatorDetail.validators')}</Link>
                <span className="mx-2">/</span>
                <span className="text-white">{validator.moniker}</span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-2">{t('validatorDetail.title')}</h1>
              <p className="text-gray-400">
                {t('validatorDetail.subtitle')} {validator.moniker}
              </p>
            </div>
            
            {/* Live indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-xs text-gray-400">
                {isRefreshing ? t('validatorDetail.updating') : t('validatorDetail.live')}
              </span>
            </div>
          </div>

          {/* Overview Card */}
          <div className="bg-[#1a1a1a] rounded-lg p-6 mb-6 hover:bg-[#1a1a1a]/80 transition-all duration-200">
            <h2 className="text-xl font-bold text-white mb-6">{t('validatorDetail.overview')}</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Validator Bio */}
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="relative group">
                    <ValidatorAvatar
                      identity={validator.identity}
                      moniker={validator.moniker}
                      size="xl"
                    />
                    {/* Status indicator on avatar with pulse animation */}
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#1a1a1a] ${
                      validator.status === 'BOND_STATUS_BONDED' 
                        ? 'bg-green-500 animate-pulse' 
                        : validator.status === 'BOND_STATUS_UNBONDING'
                        ? 'bg-yellow-500'
                        : 'bg-gray-500'
                    }`}>
                      {validator.status === 'BOND_STATUS_BONDED' && (
                        <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75"></span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-2xl font-bold text-white truncate">{validator.moniker}</h3>
                      <button 
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 whitespace-nowrap"
                        onClick={() => setShowStakeModal(true)}
                      >
                        Manage Stake
                      </button>
                    </div>
                    
                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                        validator.status === 'BOND_STATUS_BONDED' 
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                          : validator.status === 'BOND_STATUS_UNBONDING'
                          ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                          : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                      }`}>
                        {validator.status?.replace('BOND_STATUS_', '') || 'UNKNOWN'}
                      </span>
                      {validator.jailed && (
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-200 animate-pulse">
                          JAILED
                        </span>
                      )}
                    </div>

                    {validator.website && (
                      <a 
                        href={validator.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-400 text-sm flex items-center gap-1 mb-2 transition-all duration-200 hover:gap-2"
                      >
                        🔗 {validator.website}
                      </a>
                    )}
                    {validator.details && (
                      <p className="text-gray-400 text-sm mt-2 line-clamp-3">{validator.details}</p>
                    )}
                  </div>
                </div>
                
                {/* Addresses */}
                <div className="space-y-3 bg-[#111111] rounded-lg p-4 hover:bg-[#111111]/80 transition-all duration-200">
                  <div>
                    <p className="text-gray-400 text-xs font-medium mb-1.5">{t('validatorDetail.operatorAddress')}</p>
                    <div className="flex items-center gap-2 bg-[#0a0a0a] rounded px-3 py-2 hover:bg-[#0a0a0a]/80 transition-all duration-200 group">
                      <p className="text-white font-mono text-xs break-all flex-1">{validator.address}</p>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(validator.address);

                        }}
                        className="text-gray-400 hover:text-blue-500 transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95"
                        title="Copy address"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs font-medium mb-1.5">{t('validatorDetail.selfDelegateAddress')}</p>
                    <div className="flex items-center gap-2 bg-[#0a0a0a] rounded px-3 py-2 hover:bg-[#0a0a0a]/80 transition-all duration-200 group">
                      <p className="text-white font-mono text-xs break-all flex-1">
                        {validator?.accountAddress || (validator?.address ? convertValidatorToAccountAddress(validator.address) : 'Not Available')}
                      </p>
                      <button 
                        onClick={() => {
                          const addr = validator?.accountAddress || (validator?.address ? convertValidatorToAccountAddress(validator.address) : '');
                          if (addr) {
                            navigator.clipboard.writeText(addr);
                          }
                        }}
                        className="text-gray-400 hover:text-blue-500 transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95"
                        title="Copy address"
                        disabled={!validator?.address}
                      >
                        📋
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Stats */}
              <div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Voting Power */}
                  <div className="bg-[#111111] rounded-lg p-4 border border-gray-800 hover:border-blue-500/50 hover:scale-105 transition-all duration-200 group">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-blue-500 group-hover:rotate-12 transition-transform duration-200" />
                      <h4 className="text-gray-400 text-xs font-medium">{t('validatorDetail.votingPower')}</h4>
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">
                      {isNaN(parseFloat(validator.votingPowerPercentage)) 
                        ? '0.00' 
                        : parseFloat(validator.votingPowerPercentage).toFixed(2)
                      }%
                    </p>
                    <p className="text-xs text-gray-500">
                      {(parseInt(validator.votingPower || '0') / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })} {selectedChain?.assets[0].symbol}
                    </p>
                  </div>

                  {/* Commission */}
                  <div className="bg-[#111111] rounded-lg p-4 border border-gray-800 hover:border-blue-500/50 hover:scale-105 transition-all duration-200 group">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-blue-500 group-hover:rotate-12 transition-transform duration-200" />
                      <h4 className="text-gray-400 text-xs font-medium">{t('validatorDetail.commission')}</h4>
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">
                      {isNaN(parseFloat(validator.commission)) 
                        ? '0.00' 
                        : (parseFloat(validator.commission) * 100).toFixed(2)
                      }%
                    </p>
                    <p className="text-xs text-gray-500">
                      {t('validatorDetail.max')}: {isNaN(parseFloat(validator.maxCommission)) 
                        ? '0.00' 
                        : (parseFloat(validator.maxCommission) * 100).toFixed(2)
                      }%
                    </p>
                  </div>

                  {/* Status */}
                  <div className="bg-[#111111] rounded-lg p-4 border border-gray-800 hover:border-blue-500/50 hover:scale-105 transition-all duration-200 group">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-blue-500 group-hover:rotate-12 transition-transform duration-200" />
                      <h4 className="text-gray-400 text-xs font-medium">{t('validatorDetail.status')}</h4>
                    </div>
                    <p className={`text-xl font-bold mb-1 ${
                      validator.status === 'BOND_STATUS_BONDED'
                        ? 'text-green-400'
                        : validator.status === 'BOND_STATUS_UNBONDING'
                        ? 'text-yellow-400'
                        : 'text-gray-400'
                    }`}>
                      {validator.status === 'BOND_STATUS_BONDED' ? t('validatorDetail.active') : validator.status === 'BOND_STATUS_UNBONDING' ? t('validatorDetail.unbonding') : t('validatorDetail.inactive')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {validator.jailed ? t('validatorDetail.jailed') : t('validatorDetail.notJailed')}
                    </p>
                  </div>

                  {/* Self Bonded */}
                  <div className="bg-[#111111] rounded-lg p-4 border border-gray-800 hover:border-blue-500/50 hover:scale-105 transition-all duration-200 group">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-4 h-4 text-blue-500 group-hover:rotate-12 transition-transform duration-200" />
                      <h4 className="text-gray-400 text-xs font-medium">{t('validatorDetail.selfBonded')}</h4>
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">
                      {(parseInt(validator.tokens || '0') / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-gray-500">{selectedChain?.assets[0].symbol}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Voting Power Card - Full Width */}
          <div className="mb-6">
            <div className="bg-[#1a1a1a] rounded-lg p-6 hover:bg-[#1a1a1a]/80 transition-all duration-200 group">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
                <h2 className="text-xl font-bold text-white">Voting Power</h2>
              </div>
              
              <div className="mb-6">
                <p className="text-5xl font-bold text-blue-500 mb-2 transition-all duration-300">
                  {isNaN(parseFloat(validator.votingPowerPercentage)) 
                    ? '0.00' 
                    : parseFloat(validator.votingPowerPercentage).toFixed(2)
                  }%
                </p>
                <p className="text-gray-400 text-sm">
                  {(parseInt(validator.votingPower || '0') / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })} / {(parseInt(validator.tokens || '0') / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })} {selectedChain?.assets[0].symbol}
                </p>
              </div>
              
              {/* Progress bar */}
              <div className="bg-gray-800 rounded-full h-3 mb-6 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${isNaN(parseFloat(validator.votingPowerPercentage)) ? 0 : Math.min(parseFloat(validator.votingPowerPercentage), 100)}%` 
                  }}
                >
                </div>
              </div>

              {/* 3 column info */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#111111] rounded-lg p-3 hover:bg-[#111111]/70 hover:scale-105 transition-all duration-200">
                  <p className="text-gray-400 text-xs font-medium mb-1">Block</p>
                  <p className="text-white font-bold text-lg">0</p>
                </div>
                <div className="bg-[#111111] rounded-lg p-3 hover:bg-[#111111]/70 hover:scale-105 transition-all duration-200">
                  <p className="text-gray-400 text-xs font-medium mb-1">Power</p>
                  <p className="text-white font-bold text-lg">{(parseInt(validator.votingPower || '0') / 1000000).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <div className="bg-[#111111] rounded-lg p-3 hover:bg-[#111111]/70 hover:scale-105 transition-all duration-200">
                  <p className="text-gray-400 text-xs font-medium mb-1">Percentage</p>
                  <p className="text-blue-500 font-bold text-lg">
                    {isNaN(parseFloat(validator.votingPowerPercentage)) 
                      ? '0.00' 
                      : parseFloat(validator.votingPowerPercentage).toFixed(2)
                    }%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rewards & Commission Section */}
          <div className="mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rewards Card */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 hover:bg-[#1a1a1a]/80 transition-all duration-200">
                <div className="flex items-center gap-2 mb-6">
                  <Award className="w-5 h-5 text-blue-500" />
                  <h2 className="text-xl font-bold text-white">Validator Rewards</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Total Rewards */}
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-2">Total Rewards</p>
                    <p className="text-2xl font-bold text-white mb-1">
                      {(parseInt(validator?.tokens || '0') * 0.0001 / 1000000).toLocaleString(undefined, { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4 
                      })}
                    </p>
                    <p className="text-blue-400 text-xs">{selectedChain?.assets[0].symbol}</p>
                  </div>

                  {/* Claimable */}
                  <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-2">Claimable</p>
                    <p className="text-2xl font-bold text-white mb-1">
                      {(parseInt(validator?.tokens || '0') * 0.00005 / 1000000).toLocaleString(undefined, { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4 
                      })}
                    </p>
                    <p className="text-green-400 text-xs">{selectedChain?.assets[0].symbol}</p>
                  </div>

                  {/* Daily Rate */}
                  <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-2">Daily Rate</p>
                    <p className="text-2xl font-bold text-white mb-1">~12.5%</p>
                    <p className="text-purple-400 text-xs">APR</p>
                  </div>

                  {/* Last Claim */}
                  <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-2">Last Claim</p>
                    <p className="text-lg font-bold text-white mb-1">N/A</p>
                    <p className="text-orange-400 text-xs">Not Available</p>
                  </div>
                </div>
              </div>

              {/* Commission Card */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 hover:bg-[#1a1a1a]/80 transition-all duration-200">
                <div className="flex items-center gap-2 mb-6">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  <h2 className="text-xl font-bold text-white">Commission Info</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Current Rate */}
                  <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-2">Current Rate</p>
                    <p className="text-3xl font-bold text-white mb-1">
                      {isNaN(parseFloat(validator?.commission || '0')) 
                        ? '0.00' 
                        : (parseFloat(validator.commission) * 100).toFixed(2)
                      }%
                    </p>
                    <p className="text-green-400 text-xs">Commission</p>
                  </div>

                  {/* Total Earned */}
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-2">Total Earned</p>
                    <p className="text-2xl font-bold text-white mb-1">
                      {(parseInt(validator?.tokens || '0') * parseFloat(validator?.commission || '0') / 1000000).toLocaleString(undefined, { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4 
                      })}
                    </p>
                    <p className="text-blue-400 text-xs">{selectedChain?.assets[0].symbol}</p>
                  </div>

                  {/* Max Rate */}
                  <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-2">Max Rate</p>
                    <p className="text-2xl font-bold text-white mb-1">
                      {isNaN(parseFloat(validator?.maxCommission || '0')) 
                        ? '0.00' 
                        : (parseFloat(validator.maxCommission) * 100).toFixed(2)
                      }%
                    </p>
                    <p className="text-red-400 text-xs">Maximum</p>
                  </div>

                  {/* Max Change */}
                  <div className="bg-[#111111] border border-gray-800 rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-2">Max Change</p>
                    <p className="text-2xl font-bold text-white mb-1">
                      {isNaN(parseFloat(validator?.maxChangeRate || '0')) 
                        ? '0.00' 
                        : (parseFloat(validator.maxChangeRate) * 100).toFixed(2)
                      }%
                    </p>
                    <p className="text-yellow-400 text-xs">Per day</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Section */}
          <div className="bg-[#1a1a1a] rounded-lg overflow-hidden hover:bg-[#1a1a1a]/80 transition-all duration-200">
            {/* Tab Headers */}
            <div className="flex border-b border-gray-800">
              <button
                onClick={() => setActiveTab('delegations')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'delegations'
                    ? 'text-white bg-blue-500 scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Users className={`w-4 h-4 ${activeTab === 'delegations' ? 'animate-pulse' : ''}`} />
                  <span>Delegations</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs transition-all duration-200 ${
                    activeTab === 'delegations' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {delegations.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('unbonding')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'unbonding'
                    ? 'text-white bg-blue-500 scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Clock className={`w-4 h-4 ${activeTab === 'unbonding' ? 'animate-pulse' : ''}`} />
                  <span>Unbonding</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs transition-all duration-200 ${
                    activeTab === 'unbonding' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {unbondingDelegations.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'transactions'
                    ? 'text-white bg-blue-500 scale-105'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FileText className={`w-4 h-4 ${activeTab === 'transactions' ? 'animate-pulse' : ''}`} />
                  <span>Transactions</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs transition-all duration-200 ${
                    activeTab === 'transactions' 
                      ? 'bg-white/20 text-white' 
                      : 'bg-gray-800 text-gray-400'
                  }`}>
                    {transactions.length}
                  </span>
                </div>
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'delegations' && (
                <div>
                  {delegations.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">No delegations found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[#111111] border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">#</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Delegator</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-400">Amount</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-400">Shares</th>
                          </tr>
                        </thead>
                        <tbody>
                          {delegations.map((delegation, idx) => (
                            <tr key={idx} className="border-b border-gray-800 hover:bg-[#111111] transition-colors">
                              <td className="px-4 py-3 text-gray-400 text-sm">{idx + 1}</td>
                              <td className="px-4 py-3">
                                <Link
                                  href={`/${chainPath}/accounts/${delegation.delegator}`}
                                  className="text-blue-500 hover:text-blue-400 transition-colors font-mono text-sm"
                                >
                                  {delegation.delegator.slice(0, 15)}...{delegation.delegator.slice(-6)}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-right text-white font-medium">
                                {(parseFloat(delegation.balance) / 1000000).toLocaleString(undefined, { 
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 4 
                                })} {selectedChain?.assets[0].symbol}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-400">
                                {(parseFloat(delegation.shares) / 1000000).toLocaleString(undefined, { 
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 2 
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'unbonding' && (
                <div>
                  {unbondingDelegations.length === 0 ? (
                    <div className="text-center py-12">
                      <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">No unbonding delegations found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[#111111] border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">#</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Delegator</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-400">Amount</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Completion Time</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-400">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unbondingDelegations.flatMap((unbonding, idx) => 
                            unbonding.entries.map((entry, entryIdx) => (
                              <tr key={`${idx}-${entryIdx}`} className="border-b border-gray-800 hover:bg-[#111111] transition-colors">
                                <td className="px-4 py-3 text-gray-400 text-sm">{idx + 1}.{entryIdx + 1}</td>
                                <td className="px-4 py-3">
                                  <Link
                                    href={`/${chainPath}/accounts/${unbonding.delegator}`}
                                    className="text-blue-500 hover:text-blue-400 transition-colors font-mono text-sm"
                                  >
                                    {unbonding.delegator.slice(0, 15)}...{unbonding.delegator.slice(-6)}
                                  </Link>
                                </td>
                                <td className="px-4 py-3 text-right text-white font-medium">
                                  {(parseFloat(entry.balance) / 1000000).toLocaleString(undefined, { 
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 4 
                                  })} {selectedChain?.assets[0].symbol}
                                </td>
                                <td className="px-4 py-3 text-gray-400 text-sm">
                                  {new Date(entry.completionTime).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-3 py-1 bg-orange-500/20 text-orange-500 rounded-full text-xs">
                                    Unbonding
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'transactions' && (
                <div>
                  {transactions.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">No transactions found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[#111111] border-b border-gray-800">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Tx Hash</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Type</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Height</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Time</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((tx, idx) => (
                            <tr key={idx} className="border-b border-gray-800 hover:bg-[#111111] transition-colors">
                              <td className="px-4 py-3">
                                <Link
                                  href={`/${chainPath}/transactions/${tx.hash}`}
                                  className="text-blue-500 hover:text-blue-400 transition-colors font-mono text-sm"
                                >
                                  {tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}
                                </Link>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                                  {tx.type}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <Link
                                  href={`/${chainPath}/blocks/${tx.height}`}
                                  className="text-blue-500 hover:text-blue-400 transition-colors"
                                >
                                  {tx.height.toLocaleString()}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-gray-400 text-sm">
                                {new Date(tx.time).toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  tx.result === 'Success' 
                                    ? 'bg-green-500/10 text-green-500' 
                                    : 'bg-red-500/10 text-red-500'
                                }`}>
                                  {tx.result}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Stake Management Modal */}
      {showStakeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowStakeModal(false)}>
          <div className="bg-[#1a1a1a] rounded-2xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button 
              onClick={() => setShowStakeModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>

            {/* Header */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-1">Manage Stake with {validator?.moniker}</h2>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Staked: 380.317 LUME</span>
                <span className="text-gray-400">Balance: 0.624 LUME</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 bg-[#111111] p-1 rounded-lg">
              <button
                onClick={() => setStakeTab('delegate')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  stakeTab === 'delegate' 
                    ? 'bg-white text-black' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Delegate
              </button>
              <button
                onClick={() => setStakeTab('undelegate')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  stakeTab === 'undelegate' 
                    ? 'bg-white text-black' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Undelegate
              </button>
              <button
                onClick={() => setStakeTab('redelegate')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  stakeTab === 'redelegate' 
                    ? 'bg-white text-black' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Redelegate
              </button>
              <button
                onClick={() => setStakeTab('withdraw')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  stakeTab === 'withdraw' 
                    ? 'bg-white text-black' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Withdraw
              </button>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-white text-sm font-medium">Amount to {stakeTab === 'delegate' ? 'Delegate' : stakeTab === 'undelegate' ? 'Undelegate' : stakeTab === 'redelegate' ? 'Redelegate' : 'Withdraw'}</label>
                <span className="text-gray-400 text-xs">Available: 0.624 LUME</span>
              </div>
              <input
                type="text"
                value={stakeAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^\d*\.?\d*$/.test(value)) {
                    setStakeAmount(value);
                  }
                }}
                placeholder="0.62393"
                className="w-full bg-[#111111] border border-gray-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Percentage Slider */}
            <div className="mb-6">
              <input
                type="range"
                min="0"
                max="100"
                value={stakePercentage}
                onChange={(e) => setStakePercentage(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between mt-2">
                <button 
                  onClick={() => setStakePercentage(25)}
                  className="px-3 py-1 bg-[#111111] hover:bg-[#222222] text-gray-400 text-xs rounded-lg transition-colors"
                >
                  25%
                </button>
                <button 
                  onClick={() => setStakePercentage(50)}
                  className="px-3 py-1 bg-[#111111] hover:bg-[#222222] text-gray-400 text-xs rounded-lg transition-colors"
                >
                  50%
                </button>
                <button 
                  onClick={() => setStakePercentage(100)}
                  className="px-3 py-1 bg-[#111111] hover:bg-[#222222] text-gray-400 text-xs rounded-lg transition-colors"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Advanced Options */}
            <details className="mb-6">
              <summary className="text-gray-400 text-sm cursor-pointer flex items-center gap-2 hover:text-white transition-colors">
                <span>⚙️</span> Advanced Options
              </summary>
            </details>

            {/* Confirm Button */}
            <button className="w-full bg-white hover:bg-gray-200 text-black font-medium py-3 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98]">
              Confirm {stakeTab === 'delegate' ? 'Delegate' : stakeTab === 'undelegate' ? 'Undelegate' : stakeTab === 'redelegate' ? 'Redelegate' : 'Withdraw'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

