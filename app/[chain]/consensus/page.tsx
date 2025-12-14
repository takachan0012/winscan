'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import ValidatorAvatar from '@/components/ValidatorAvatar';
import { ChainData } from '@/types/chain';
import { Shield, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface ValidatorConsensus {
  address: string;
  moniker: string;
  identity: string;
  operator_address: string;
  voting_power: string;
  proposer_priority: string;
  is_signing: boolean;
}

export default function ConsensusPage() {
  const params = useParams();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [consensusData, setConsensusData] = useState<any>(null);
  const [validators, setValidators] = useState<ValidatorConsensus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRpc, setActiveRpc] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkRpcIndexer = async (rpcUrl: string): Promise<boolean> => {
    try {
      const response = await fetch(`${rpcUrl}/status`);
      const data = await response.json();
      const txIndex = data?.result?.node_info?.other?.tx_index;
      return txIndex === 'on';
    } catch {
      return false;
    }
  };

  const findRpcWithIndexer = async (rpcList: any[]): Promise<string | null> => {
    for (const rpc of rpcList) {
      const hasIndexer = await checkRpcIndexer(rpc.address);
      if (hasIndexer) {
        return rpc.address;
      }
    }
    return null;
  };

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
    if (selectedChain && selectedChain.rpc && selectedChain.rpc.length > 0) {
      setLoading(true);
      
      findRpcWithIndexer(selectedChain.rpc)
        .then(rpcUrl => {
          if (!rpcUrl) {
            rpcUrl = selectedChain.rpc[0].address;
          }
          
          setActiveRpc(rpcUrl);
          
          return Promise.all([
            fetch(`${rpcUrl}/consensus_state`).then(r => r.json()),
            fetch(`${rpcUrl}/validators?per_page=1000`).then(r => r.json()),
            fetch(`${rpcUrl}/block`).then(r => r.json()),
            selectedChain.api && selectedChain.api.length > 0
              ? fetch(`${selectedChain.api[0].address}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=1000`).then(r => r.json())
              : Promise.resolve({ validators: [] })
          ]);
        })
        .then(([consensusState, validatorsData, blockData, stakingValidators]) => {
          const roundState = consensusState?.result?.round_state;
          const heightVoteSet = roundState?.height_vote_set?.[0];
          
          setConsensusData({
            height: roundState?.height || blockData?.result?.block?.header?.height || '0',
            round: roundState?.round || '0',
            step: roundState?.step || 'Unknown',
            startTime: roundState?.start_time || new Date().toISOString(),
            proposer: roundState?.proposer?.address || 'Unknown',
            precommits: heightVoteSet?.precommits_bit_array || 'N/A',
            prevotes: heightVoteSet?.prevotes_bit_array || 'N/A',
          });

          const vals = validatorsData?.result?.validators || [];
          const lastCommit = blockData?.result?.block?.last_commit?.signatures || [];
          const stakingVals = stakingValidators?.validators || [];

          const validatorMap = new Map();
          stakingVals.forEach((val: any) => {
            validatorMap.set(val.consensus_pubkey?.key, {
              moniker: val.description?.moniker || 'Unknown',
              identity: val.description?.identity || '',
              operator_address: val.operator_address,
            });
          });
          
          const parsedValidators = vals.map((val: any) => {

            const isSigning = lastCommit.some((sig: any) => 
              sig.validator_address === val.address && sig.signature !== null
            );

            const validatorInfo = validatorMap.get(val.pub_key?.value) || {};

            return {
              address: val.address,
              moniker: validatorInfo.moniker || 'Unknown Validator',
              identity: validatorInfo.identity || '',
              operator_address: validatorInfo.operator_address || '',
              voting_power: val.voting_power,
              proposer_priority: val.proposer_priority || '0',
              is_signing: isSigning,
            };
          });

          parsedValidators.sort((a: ValidatorConsensus, b: ValidatorConsensus) => {

            if (a.is_signing && !b.is_signing) return -1;
            if (!a.is_signing && b.is_signing) return 1;

            return parseInt(b.voting_power) - parseInt(a.voting_power);
          });

          setValidators(parsedValidators);
          setLastUpdate(new Date());
          setLoading(false);
        })
        .catch((error) => {
          console.error('Error fetching consensus data:', error);
          setLoading(false);
        });
    }
  }, [selectedChain]);

  useEffect(() => {
    if (!selectedChain || !selectedChain.rpc || selectedChain.rpc.length === 0) return;
    if (!activeRpc || loading) return; // Don't start until initial load complete

    const refreshInterval = setInterval(() => {

      setIsRefreshing(true);
      
      Promise.all([
        fetch(`${activeRpc}/consensus_state`).then(r => r.json()),
        fetch(`${activeRpc}/validators?per_page=1000`).then(r => r.json()),
        fetch(`${activeRpc}/block`).then(r => r.json()),
      ])
        .then(([consensusState, validatorsData, blockData]) => {
          const roundState = consensusState?.result?.round_state;
          const heightVoteSet = roundState?.height_vote_set?.[0];

          setConsensusData({
            height: roundState?.height || blockData?.result?.block?.header?.height || '0',
            round: roundState?.round || '0',
            step: roundState?.step || 'Unknown',
            startTime: roundState?.start_time || new Date().toISOString(),
            proposer: roundState?.proposer?.address || 'Unknown',
            precommits: heightVoteSet?.precommits_bit_array || 'N/A',
            prevotes: heightVoteSet?.prevotes_bit_array || 'N/A',
          });

          const vals = validatorsData?.result?.validators || [];
          const lastCommit = blockData?.result?.block?.last_commit?.signatures || [];
          
          setValidators(prev => {
            return prev.map(val => {
              const isSigning = lastCommit.some((sig: any) => 
                sig.validator_address === val.address && sig.signature !== null
              );
              return { ...val, is_signing: isSigning };
            });
          });

          setLastUpdate(new Date());
          setIsRefreshing(false);
        })
        .catch(err => {
          console.error('Auto-refresh error:', err);
          setIsRefreshing(false);
        });
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(refreshInterval);
  }, [activeRpc, selectedChain, loading]);

  const signingValidators = validators.filter(v => v.is_signing).length;
  const totalValidators = validators.length;
  const signingPercentage = totalValidators > 0 ? ((signingValidators / totalValidators) * 100).toFixed(2) : '0';

  const formatVotingPower = (power: string) => {
    const num = parseInt(power);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex">
      <Sidebar selectedChain={selectedChain} />

      <div className="flex-1 flex flex-col">
        <Header 
          chains={chains}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />

        <main className="flex-1 mt-32 md:mt-16 p-3 md:p-6 overflow-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
              <Shield className="w-8 h-8 mr-3" />
              Consensus State
            </h1>
            <p className="text-gray-400">
              Monitor validator participation and consensus progress in real-time
            </p>
          </div>

          {activeRpc && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-400">
                ✅ Using RPC with indexer: <code className="font-mono text-green-300">{activeRpc}</code>
              </p>
            </div>
          )}

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-400">Loading consensus information...</p>
            </div>
          ) : consensusData ? (
            <div className="space-y-6">
              {/* Consensus Info */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <h2 className="text-xl font-bold text-white mb-4">Current Consensus State</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Onboard Rate</p>
                    <p className="text-2xl font-bold text-blue-500">{signingPercentage}%</p>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Height</p>
                    <p className="text-2xl font-bold text-green-500">{parseInt(consensusData.height).toLocaleString()}</p>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Round</p>
                    <p className="text-2xl font-bold text-purple-500">{consensusData.round}</p>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Step</p>
                    <p className="text-2xl font-bold text-orange-500">{consensusData.step}</p>
                  </div>
                </div>
                
                {/* Update Time - Subtle indicator */}
                <div className="mt-4 text-sm text-gray-500 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    isRefreshing ? 'bg-blue-400 scale-110' : 'bg-gray-600 scale-100'
                  }`}></div>
                  <span>Updated at {lastUpdate.toLocaleTimeString('en-US', { hour12: false })}</span>
                </div>
                
                {/* Round Info */}
                <div className="mt-4 p-3 bg-[#0f0f0f] rounded font-mono text-sm text-gray-300">
                  <div>Round: {consensusData.round}</div>
                </div>
              </div>

              {/* Validator Grid */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Validator Status</h2>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded"></div>
                      <span className="text-gray-400">Signing ({signingValidators})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded"></div>
                      <span className="text-gray-400">Not Signing ({totalValidators - signingValidators})</span>
                    </div>
                  </div>
                </div>

                {/* Info Banner */}
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-300">
                    <p className="font-semibold mb-1">Monitor Validator Status</p>
                    <p className="text-blue-400/80">
                      This tool is useful for validators to monitor who is onboard during an upgrade or to check real-time consensus participation.
                    </p>
                  </div>
                </div>

                {/* Validator Grid Layout (like Ping.pub) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {validators.map((val, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                        val.is_signing
                          ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20'
                          : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
                      }`}
                    >
                      {val.is_signing ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <div className="flex gap-0.5 flex-shrink-0">
                          <div className="w-1 h-4 bg-red-500"></div>
                          <div className="w-1 h-4 bg-red-500"></div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <ValidatorAvatar
                          identity={val.identity}
                          moniker={val.moniker}
                          size="sm"
                        />
                        <span className="text-white text-sm font-medium truncate">
                          {val.moniker}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {validators.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Shield className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>No validator data available</p>
                  </div>
                )}
              </div>

              {/* Consensus Details */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <h2 className="text-xl font-bold text-white mb-4">Additional Information</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-800">
                    <span className="text-gray-400">Total Validators</span>
                    <span className="text-white font-bold">{totalValidators}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-800">
                    <span className="text-gray-400">Signing Validators</span>
                    <span className="text-green-400 font-bold">{signingValidators} ({signingPercentage}%)</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-800">
                    <span className="text-gray-400">Not Signing</span>
                    <span className="text-red-400 font-bold">{totalValidators - signingValidators}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-800">
                    <span className="text-gray-400">Proposer Address</span>
                    <code className="text-blue-400 font-mono text-sm">{consensusData.proposer}</code>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-800">
                    <span className="text-gray-400">Start Time</span>
                    <span className="text-white font-mono text-sm">
                      {new Date(consensusData.startTime).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-400">Chain Height</span>
                    <span className="text-white font-bold">{parseInt(consensusData.height).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500 opacity-50" />
              <p className="text-gray-400">Unable to load consensus data</p>
              <p className="text-gray-500 text-sm mt-2">Please check RPC connection or try again later</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

