'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { ChainData } from '@/types/chain';
import { Settings, Shield, Vote, DollarSign, Users, Clock, Layers } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { 
  fetchStakingParamsDirectly, 
  fetchSlashingParamsDirectly, 
  fetchGovParamsDirectly,
  fetchDistributionParamsDirectly,
  fetchMintParamsDirectly
} from '@/lib/cosmos-client';

interface ChainParameters {
  staking?: {
    unbonding_time?: string;
    max_validators?: number;
    max_entries?: number;
    historical_entries?: number;
    bond_denom?: string;
    min_commission_rate?: string;
  };
  slashing?: {
    signed_blocks_window?: string;
    min_signed_per_window?: string;
    downtime_jail_duration?: string;
    slash_fraction_double_sign?: string;
    slash_fraction_downtime?: string;
  };
  gov?: {
    min_deposit?: { amount: string; denom: string }[];
    max_deposit_period?: string;
    voting_period?: string;
    quorum?: string;
    threshold?: string;
    veto_threshold?: string;
  };
  distribution?: {
    community_tax?: string;
    base_proposer_reward?: string;
    bonus_proposer_reward?: string;
    withdraw_addr_enabled?: boolean;
  };
  mint?: {
    mint_denom?: string;
    inflation_rate_change?: string;
    inflation_max?: string;
    inflation_min?: string;
    goal_bonded?: string;
    blocks_per_year?: string;
  };
}

export default function ParametersPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [parameters, setParameters] = useState<ChainParameters | null>(null);
  const [loading, setLoading] = useState(true);

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
        });
    }
  }, [params]);

  useEffect(() => {
    if (!selectedChain) return;
    
    const chainName = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
    const cacheKey = `parameters_${chainName}`;
    const cacheTimeout = 600000; // 10 minutes

    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        setParameters(data);
        setLoading(false);

        if (Date.now() - timestamp < cacheTimeout) {
          return;
        }
      }
    } catch (e) {
      console.warn('Cache read error:', e);
    }

    const fetchParams = async () => {
      try {
        // Strategy: Try direct LCD fetch first
        const lcdEndpoints = selectedChain.api?.map(api => ({
          address: api.address,
          provider: api.provider || 'Unknown'
        })) || [];
        
        if (lcdEndpoints.length > 0) {
          try {
            console.log(`[Parameters] Using direct LCD fetch for ${selectedChain.chain_name}`);
            
            const chainPath = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
            
            // Fetch all params in parallel with smart fallback
            const [staking, slashing, gov, distribution, mint] = await Promise.allSettled([
              fetchStakingParamsDirectly(lcdEndpoints, chainPath),
              fetchSlashingParamsDirectly(lcdEndpoints, chainPath),
              fetchGovParamsDirectly(lcdEndpoints, chainPath),
              fetchDistributionParamsDirectly(lcdEndpoints, chainPath),
              fetchMintParamsDirectly(lcdEndpoints, chainPath)
            ]);
            
            const paramsData: ChainParameters = {
              staking: staking.status === 'fulfilled' && staking.value ? staking.value.params || staking.value : undefined,
              slashing: slashing.status === 'fulfilled' && slashing.value ? slashing.value.params || slashing.value : undefined,
              gov: gov.status === 'fulfilled' && gov.value ? {
                ...gov.value.voting_params?.voting_params,
                ...gov.value.deposit_params?.deposit_params,
                ...gov.value.tally_params?.tally_params
              } : undefined,
              distribution: distribution.status === 'fulfilled' && distribution.value ? distribution.value.params || distribution.value : undefined,
              mint: mint.status === 'fulfilled' && mint.value ? mint.value.params || mint.value : undefined,
            };
            
            console.log('[Parameters] Extracted params:', paramsData);
            
            setParameters(paramsData);
            setLoading(false);
            
            try {
              sessionStorage.setItem(cacheKey, JSON.stringify({ data: paramsData, timestamp: Date.now() }));
            } catch (e) {
              console.warn('Cache write error:', e);
            }
            return;
          } catch (directError) {
            console.warn('[Parameters] Direct LCD fetch failed, trying server API:', directError);
          }
        }
        
        // Fallback: Server API
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const res = await fetch(`/api/parameters?chain=${chainName}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const data = await res.json();
        console.log('Parameters data:', data);
        setParameters(data);
        setLoading(false);
        
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
        } catch (e) {
          console.warn('Cache write error:', e);
        }
      } catch (err) {
        console.error('Error loading parameters:', err);
        setLoading(false);
      }
    };
    
    fetchParams();
  }, [selectedChain]);

  const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-16 p-6 overflow-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{t('params.title')}</h1>
              <p className="text-gray-400">
                {t('params.subtitle')} {selectedChain?.chain_name} {t('params.network')}
              </p>
            </div>
          </div>

          {parameters && !('error' in parameters) && Object.keys(parameters).length > 0 ? (
            <div className="space-y-6">
              {/* Staking Parameters */}
              {parameters.staking && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-500" />
                    {t('params.staking')}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {parameters.staking.unbonding_time && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.unbondingTime')}</p>
                        <p className="text-white font-bold">
                          {parseInt(parameters.staking.unbonding_time) / (24 * 60 * 60)} {t('params.days')}
                        </p>
                      </div>
                    )}

                    {parameters.staking.max_validators && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.maxValidators')}</p>
                        <p className="text-white font-bold">{parameters.staking.max_validators}</p>
                      </div>
                    )}

                    {parameters.staking.max_entries && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.maxEntries')}</p>
                        <p className="text-white font-bold">{parameters.staking.max_entries}</p>
                      </div>
                    )}

                    {parameters.staking.bond_denom && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.bondDenom')}</p>
                        <p className="text-white font-mono text-sm">{parameters.staking.bond_denom}</p>
                      </div>
                    )}

                    {parameters.staking.min_commission_rate && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.minCommissionRate')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.staking.min_commission_rate) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.staking.historical_entries && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.historicalEntries')}</p>
                        <p className="text-white font-bold">{parameters.staking.historical_entries}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Governance Parameters */}
              {parameters.gov && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Vote className="w-5 h-5 text-blue-500" />
                    {t('params.governance')}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {parameters.gov.voting_period && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.votingPeriod')}</p>
                        <p className="text-white font-bold">
                          {parseInt(parameters.gov.voting_period) / (24 * 60 * 60)} {t('params.days')}
                        </p>
                      </div>
                    )}

                    {parameters.gov.max_deposit_period && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.maxDepositPeriod')}</p>
                        <p className="text-white font-bold">
                          {parseInt(parameters.gov.max_deposit_period) / (24 * 60 * 60)} {t('params.days')}
                        </p>
                      </div>
                    )}

                    {parameters.gov.min_deposit && parameters.gov.min_deposit[0] && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.minDeposit')}</p>
                        <p className="text-white font-bold">
                          {(parseInt(parameters.gov.min_deposit[0].amount) / 1000000).toLocaleString()} {selectedChain?.assets[0].symbol}
                        </p>
                      </div>
                    )}

                    {parameters.gov.quorum && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.quorum')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.gov.quorum) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.gov.threshold && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.threshold')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.gov.threshold) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.gov.veto_threshold && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.vetoThreshold')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.gov.veto_threshold) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Slashing Parameters */}
              {parameters.slashing && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    {t('params.slashing')}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {parameters.slashing.signed_blocks_window && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.signedBlocksWindow')}</p>
                        <p className="text-white font-bold">{parseInt(parameters.slashing.signed_blocks_window).toLocaleString()}</p>
                      </div>
                    )}

                    {parameters.slashing.min_signed_per_window && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.minSignedPerWindow')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.slashing.min_signed_per_window) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.slashing.downtime_jail_duration && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.downtimeJailDuration')}</p>
                        <p className="text-white font-bold">
                          {parseInt(parameters.slashing.downtime_jail_duration) / 60} minutes
                        </p>
                      </div>
                    )}

                    {parameters.slashing.slash_fraction_double_sign && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.slashFractionDoubleSign')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.slashing.slash_fraction_double_sign) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.slashing.slash_fraction_downtime && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.slashFractionDowntime')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.slashing.slash_fraction_downtime) * 100).toFixed(4)}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Distribution Parameters */}
              {parameters.distribution && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                    {t('params.distribution')}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {parameters.distribution.community_tax && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.communityTax')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.distribution.community_tax) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.distribution.base_proposer_reward && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.baseProposerReward')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.distribution.base_proposer_reward) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.distribution.bonus_proposer_reward && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.bonusProposerReward')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.distribution.bonus_proposer_reward) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.distribution.withdraw_addr_enabled !== undefined && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.withdrawAddrEnabled')}</p>
                        <p className="text-white font-bold">
                          {parameters.distribution.withdraw_addr_enabled ? t('params.enabled') : t('params.disabled')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mint Parameters */}
              {parameters.mint && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-500" />
                    {t('params.minting')}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {parameters.mint.mint_denom && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.mintDenom')}</p>
                        <p className="text-white font-mono text-sm">{parameters.mint.mint_denom}</p>
                      </div>
                    )}

                    {parameters.mint.inflation_rate_change && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.inflationRateChange')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.mint.inflation_rate_change) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.mint.inflation_max && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.inflationMax')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.mint.inflation_max) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.mint.inflation_min && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.inflationMin')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.mint.inflation_min) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.mint.goal_bonded && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.goalBonded')}</p>
                        <p className="text-white font-bold">
                          {(parseFloat(parameters.mint.goal_bonded) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {parameters.mint.blocks_per_year && (
                      <div className="bg-[#0f0f0f] p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-400 text-sm mb-1">{t('params.blocksPerYear')}</p>
                        <p className="text-white font-bold">
                          {parseInt(parameters.mint.blocks_per_year).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-12 text-center">
              <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">{t('params.noData')}</h3>
              <p className="text-gray-400">{t('params.noDataDesc')}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

