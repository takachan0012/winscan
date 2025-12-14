'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { RefreshCw, Copy, CheckCircle, Server, Database } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function StateSyncPage() {
  const params = useParams();
  const { language } = useLanguage();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [syncInfo, setSyncInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [homeDir, setHomeDir] = useState('');
  const [peers, setPeers] = useState<string[]>([]);
  const [seeds, setSeeds] = useState<string[]>([]);
  const [loadingPeers, setLoadingPeers] = useState(false);

  useEffect(() => {
    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = params?.chain as string;
      const chain = chainName 
        ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
        : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
      if (chain) {
        setSelectedChain(chain);
        setServiceName(`${chain.chain_name}d`);
        setHomeDir(`$HOME/.${chain.chain_name}`);
      }
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
          if (chain) {
            setSelectedChain(chain);
            setServiceName(`${chain.chain_name}d`);
            setHomeDir(`$HOME/.${chain.chain_name}`);
          }
        });
    }
  }, [params]);

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
        console.log(`✅ Found RPC with indexer: ${rpc.address} (${rpc.provider})`);
        return rpc.address;
      } else {
        console.log(`❌ RPC without indexer: ${rpc.address} (${rpc.provider})`);
      }
    }
    return null;
  };

  const fetchPeersAndSeeds = async () => {
    if (!selectedChain || !selectedChain.rpc || selectedChain.rpc.length === 0) return;
    
    setLoadingPeers(true);
    const allPeers = new Set<string>();
    const allSeeds = new Set<string>();

    try {
      // Fetch from multiple RPCs to get more peers
      const rpcPromises = selectedChain.rpc.slice(0, 5).map(async (rpc: any) => {
        try {
          const response = await fetch(`${rpc.address}/net_info`, {
            signal: AbortSignal.timeout(5000) // 5 second timeout
          });
          const data = await response.json();
          return data;
        } catch (error) {
          console.log(`Failed to fetch from ${rpc.address}:`, error);
          return null;
        }
      });

      const results = await Promise.allSettled(rpcPromises);
      
      const peerData: Array<{address: string, score: number}> = [];
      const seedData: Array<{address: string, score: number}> = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.result?.peers) {
          result.value.result.peers.forEach((peer: any) => {
            // Only include active and listening peers
            if (peer.node_info && peer.remote_ip && peer.connection_status?.SendMonitor?.Active === true) {
              const peerId = peer.node_info.id;
              const ip = peer.remote_ip;
              const port = peer.node_info.listen_addr?.split(':').pop() || '26656';
              const peerAddress = `${peerId}@${ip}:${port}`;
              
              // Calculate activity score based on connection quality
              const sendRate = peer.connection_status?.SendMonitor?.AvgRate || 0;
              const recvRate = peer.connection_status?.RecvMonitor?.AvgRate || 0;
              const score = sendRate + recvRate;
              
              // Check if it's a seed node (listening = true indicates seed)
              if (peer.node_info.listen_addr && (peer.node_info.other?.seed === 'true' || !peer.is_outbound)) {
                seedData.push({ address: peerAddress, score });
              } else if (peer.is_outbound === true) {
                // Only add as peer if it's an outbound connection (active peer)
                peerData.push({ address: peerAddress, score });
              }
            }
          });
        }
      });

      // Remove duplicates and sort by score (highest activity first)
      const uniquePeers = Array.from(new Map(peerData.map(p => [p.address, p])).values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(p => p.address);
      
      const uniqueSeeds = Array.from(new Map(seedData.map(s => [s.address, s])).values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(s => s.address);

      setPeers(uniquePeers);
      setSeeds(uniqueSeeds);
    } catch (error) {
      console.error('Error fetching peers:', error);
    } finally {
      setLoadingPeers(false);
    }
  };

  const fetchStateSyncInfo = async (showLoadingState = true) => {
    if (!selectedChain || !selectedChain.rpc || selectedChain.rpc.length === 0) return;
    
    if (showLoadingState) setLoading(true);

    try {
      const rpcUrl = await findRpcWithIndexer(selectedChain.rpc);
      const finalRpcUrl = rpcUrl || selectedChain.rpc[0].address;
      
      if (!rpcUrl) {
        console.warn('⚠️ No RPC with indexer found, using first available RPC');
      }

      const [blockData, statusData] = await Promise.all([
        fetch(`${finalRpcUrl}/block`).then(r => r.json()),
        fetch(`${finalRpcUrl}/status`).then(r => r.json()),
      ]);

      const latestBlock = blockData?.result?.block;
      const status = statusData?.result;
      
      if (latestBlock) {
        const height = parseInt(latestBlock.header.height);
        const trustHeight = height - 2000;

        const trustBlockData = await fetch(`${finalRpcUrl}/block?height=${trustHeight}`).then(r => r.json());
        const trustHash = trustBlockData?.result?.block_id?.hash || '';

        const rpcPromises = selectedChain.rpc.map(async (rpc: any) => {
          const hasIndexer = await checkRpcIndexer(rpc.address);
          return hasIndexer ? rpc.address : null;
        });
        
        const rpcs = await Promise.all(rpcPromises);
        const validRpcs = rpcs.filter(r => r !== null) as string[];
        
        setSyncInfo({
          latestHeight: height,
          trustHeight: trustHeight,
          trustHash: trustHash,
          rpcServers: validRpcs.length > 0 ? validRpcs : selectedChain.rpc.map((r: any) => r.address),
          chainId: status?.node_info?.network || selectedChain.chain_id || selectedChain.chain_name,
          activeRpc: finalRpcUrl,
        });
      }
    } catch (error) {
      console.error('Error fetching state sync info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChain) {
      fetchStateSyncInfo();
      fetchPeersAndSeeds();
    }
  }, [selectedChain]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const generateStateSyncConfig = () => {
    if (!syncInfo || !selectedChain) return '';
    
    const rpcServers = syncInfo.rpcServers.join(',');
    
    return `#######################################################
###           State Sync Configuration            ###
#######################################################

[statesync]
enable = true

rpc_servers = "${rpcServers}"
trust_height = ${syncInfo.trustHeight}
trust_hash = "${syncInfo.trustHash}"
trust_period = "168h0m0s"

# Chunk request timeout
chunk_request_timeout = "10s"

# State sync RPC servers (comma-separated list)
# It's recommended to use multiple servers
temp_dir = ""`;
  };

  const generateQuickSyncScript = () => {
    if (!syncInfo || !selectedChain) return '';
    
    const rpcServer = syncInfo.rpcServers[0];
    const service = serviceName || `${selectedChain.chain_name}d`;
    const home = homeDir || `$HOME/.${selectedChain.chain_name}`;
    const binary = service; // Assuming binary name same as service
    
    return `#!/bin/bash

# Stop your node
sudo systemctl stop ${service}

# Backup priv_validator_state.json
cp ${home}/data/priv_validator_state.json $HOME/priv_validator_state.json.backup

# Reset database
${binary} tendermint unsafe-reset-all --home ${home}

# Get trust height and hash
LATEST_HEIGHT=$(curl -s ${rpcServer}/block | jq -r .result.block.header.height)
TRUST_HEIGHT=$((LATEST_HEIGHT - 2000))
TRUST_HASH=$(curl -s "${rpcServer}/block?height=\${TRUST_HEIGHT}" | jq -r .result.block_id.hash)

# Configure state sync
sed -i.bak -E "s|^(enable[[:space:]]+=[[:space:]]+).*$|\\1true|" ${home}/config/config.toml
sed -i.bak -E "s|^(rpc_servers[[:space:]]+=[[:space:]]+).*$|\\1\\"${rpcServer},${rpcServer}\\"|" ${home}/config/config.toml
sed -i.bak -E "s|^(trust_height[[:space:]]+=[[:space:]]+).*$|\\1\${TRUST_HEIGHT}|" ${home}/config/config.toml
sed -i.bak -E "s|^(trust_hash[[:space:]]+=[[:space:]]+).*$|\\1\\"\${TRUST_HASH}\\"|" ${home}/config/config.toml

# Restore priv_validator_state.json
mv $HOME/priv_validator_state.json.backup ${home}/data/priv_validator_state.json

# Start node
sudo systemctl start ${service}

echo "State sync configured! Check logs: journalctl -u ${service} -f"`;
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

        <main className="flex-1 mt-32 md:mt-16 p-3 md:p-6 overflow-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
              <RefreshCw className="w-8 h-8 mr-3" />
              State Sync Configuration
            </h1>
            <p className="text-gray-400">
              Quickly sync your node using state sync instead of downloading the entire blockchain
            </p>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-400">Loading state sync information...</p>
            </div>
          ) : syncInfo ? (
            <div className="space-y-6">
              {/* Current State Info */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Current Chain State
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Latest Height</p>
                    <p className="text-2xl font-bold text-blue-500">{syncInfo.latestHeight.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Trust Height</p>
                    <p className="text-2xl font-bold text-green-500">{syncInfo.trustHeight.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Chain ID</p>
                    <p className="text-lg font-mono text-white truncate">{syncInfo.chainId}</p>
                  </div>
                </div>
              </div>

              {/* Peers and Seeds */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center">
                    <Server className="w-5 h-5 mr-2" />
                    Active Peers & Seeds
                  </h2>
                  <button
                    onClick={fetchPeersAndSeeds}
                    disabled={loadingPeers}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingPeers ? 'animate-spin' : ''}`} />
                    <span>{loadingPeers ? 'Fetching...' : 'Refresh'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Peers */}
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white">Persistent Peers</h3>
                      {peers.length > 0 && (
                        <button
                          onClick={() => copyToClipboard(peers.join(','), 'peers-all')}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm rounded transition-colors"
                        >
                          {copied === 'peers-all' ? (
                            <><CheckCircle className="w-3 h-3" /> Copied</>
                          ) : (
                            <><Copy className="w-3 h-3" /> Copy All</>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {loadingPeers ? (
                        <div className="text-center py-8">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                          <p className="mt-2 text-gray-400 text-sm">Loading peers...</p>
                        </div>
                      ) : peers.length > 0 ? (
                        peers.map((peer, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-[#1a1a1a] rounded p-2 group">
                            <code className="text-xs text-gray-300 font-mono truncate flex-1 pr-2">{peer}</code>
                            <button
                              onClick={() => copyToClipboard(peer, `peer-${idx}`)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
                            >
                              {copied === `peer-${idx}` ? (
                                <CheckCircle className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400" />
                              )}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          No active peers found
                        </div>
                      )}
                    </div>
                    {peers.length > 0 && (
                      <p className="mt-3 text-xs text-gray-500">
                        Total: {peers.length} peer{peers.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Seeds */}
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white">Seed Nodes</h3>
                      {seeds.length > 0 && (
                        <button
                          onClick={() => copyToClipboard(seeds.join(','), 'seeds-all')}
                          className="flex items-center gap-1 px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm rounded transition-colors"
                        >
                          {copied === 'seeds-all' ? (
                            <><CheckCircle className="w-3 h-3" /> Copied</>
                          ) : (
                            <><Copy className="w-3 h-3" /> Copy All</>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {loadingPeers ? (
                        <div className="text-center py-8">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
                          <p className="mt-2 text-gray-400 text-sm">Loading seeds...</p>
                        </div>
                      ) : seeds.length > 0 ? (
                        seeds.map((seed, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-[#1a1a1a] rounded p-2 group">
                            <code className="text-xs text-gray-300 font-mono truncate flex-1 pr-2">{seed}</code>
                            <button
                              onClick={() => copyToClipboard(seed, `seed-${idx}`)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
                            >
                              {copied === `seed-${idx}` ? (
                                <CheckCircle className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400" />
                              )}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          No seed nodes found
                        </div>
                      )}
                    </div>
                    {seeds.length > 0 && (
                      <p className="mt-3 text-xs text-gray-500">
                        Total: {seeds.length} seed{seeds.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-blue-400 text-sm">
                    💡 <strong>Tip:</strong> Add these to your config.toml file:
                  </p>
                  <code className="block mt-2 text-xs text-gray-300 bg-[#0f0f0f] p-2 rounded">
                    persistent_peers = &quot;{peers.slice(0, 3).join(',')}&quot;<br />
                    seeds = &quot;{seeds.slice(0, 2).join(',')}&quot;
                  </code>
                </div>
              </div>

              {/* RPC Servers */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Server className="w-5 h-5 mr-2" />
                  Available RPC Servers (Indexer Enabled)
                </h2>
                {syncInfo.activeRpc && (
                  <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-sm text-green-400">
                      ✅ Using RPC with indexer: <code className="font-mono text-green-300">{syncInfo.activeRpc}</code>
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  {syncInfo.rpcServers.map((rpc: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-[#0f0f0f] rounded-lg p-3">
                      <div className="flex items-center gap-2 flex-1">
                        <code className="text-blue-400 font-mono text-sm">{rpc}</code>
                        {rpc === syncInfo.activeRpc && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => copyToClipboard(rpc, `rpc-${idx}`)}
                        className="ml-2 p-2 hover:bg-gray-800 rounded transition-colors"
                        title="Copy RPC URL"
                      >
                        {copied === `rpc-${idx}` ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                {syncInfo.rpcServers.length === 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-400">
                      ⚠️ No RPC with indexer enabled found. State sync may not work properly.
                    </p>
                  </div>
                )}
              </div>

              {/* Config.toml Configuration */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">config.toml Configuration</h2>
                  <button
                    onClick={() => copyToClipboard(generateStateSyncConfig(), 'config')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                  >
                    {copied === 'config' ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Config</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-[#0f0f0f] rounded-lg p-4 overflow-x-auto text-sm text-gray-300 font-mono">
                  {generateStateSyncConfig()}
                </pre>
                <p className="mt-4 text-gray-400 text-sm">
                  Add this configuration to your <code className="text-blue-400">{homeDir || `$HOME/.${selectedChain?.chain_name}`}/config/config.toml</code> file
                </p>
              </div>

              {/* Quick Sync Script */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Automated Setup Script</h2>
                  <button
                    onClick={() => copyToClipboard(generateQuickSyncScript(), 'script')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                  >
                    {copied === 'script' ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Script</span>
                      </>
                    )}
                  </button>
                </div>
                
                {/* Configuration Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Service Name
                    </label>
                    <input
                      type="text"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder={`${selectedChain?.chain_name}d`}
                      className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="mt-1 text-xs text-gray-500">Your systemd service name (e.g., lumerachain, paxid)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Home Directory
                    </label>
                    <input
                      type="text"
                      value={homeDir}
                      onChange={(e) => setHomeDir(e.target.value)}
                      placeholder={`$HOME/.${selectedChain?.chain_name}`}
                      className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <p className="mt-1 text-xs text-gray-500">Node home directory path (e.g., $HOME/.lumera, $HOME/.paxi)</p>
                  </div>
                </div>
                
                <pre className="bg-[#0f0f0f] rounded-lg p-4 overflow-x-auto text-sm text-gray-300 font-mono">
                  {generateQuickSyncScript()}
                </pre>
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <p className="text-yellow-500 font-medium mb-2">⚠️ Important Notes:</p>
                  <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
                    <li>This script will reset your node's database</li>
                    <li>Make sure to backup your validator keys before running</li>
                    <li>The script automatically backs up priv_validator_state.json</li>
                    <li>Review and modify the script according to your setup</li>
                  </ul>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <h2 className="text-xl font-bold text-white mb-4">Setup Instructions</h2>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">1</div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">Stop Your Node</h3>
                      <p className="text-gray-400 text-sm">
                        Stop your running node service before applying state sync configuration
                      </p>
                      <code className="block mt-2 bg-[#0f0f0f] p-2 rounded text-sm text-blue-400">
                        sudo systemctl stop {serviceName || `${selectedChain?.chain_name}d`}
                      </code>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">2</div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">Backup Important Files</h3>
                      <p className="text-gray-400 text-sm">
                        Backup your priv_validator_state.json to prevent double signing
                      </p>
                      <code className="block mt-2 bg-[#0f0f0f] p-2 rounded text-sm text-blue-400">
                        cp {homeDir || `$HOME/.${selectedChain?.chain_name}`}/data/priv_validator_state.json $HOME/backup.json
                      </code>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">3</div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">Apply Configuration</h3>
                      <p className="text-gray-400 text-sm">
                        Either use the automated script above or manually add the config to config.toml
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">4</div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">Start Your Node</h3>
                      <p className="text-gray-400 text-sm">
                        Start your node and monitor the logs to ensure state sync is working
                      </p>
                      <code className="block mt-2 bg-[#0f0f0f] p-2 rounded text-sm text-blue-400">
                        sudo systemctl start {serviceName || `${selectedChain?.chain_name}d`} && journalctl -u {serviceName || `${selectedChain?.chain_name}d`} -f
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] rounded-lg p-12 text-center border border-gray-800">
              <RefreshCw className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Unable to load state sync information</p>
              <p className="text-gray-500 text-sm mt-2">Please make sure the RPC endpoint is accessible</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

