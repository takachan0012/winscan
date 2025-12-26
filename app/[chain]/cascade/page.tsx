'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { Upload, MapPin, File, Download, CheckCircle, Clock, XCircle, X, Server, HardDrive, Activity } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic import map to avoid SSR issues
const ValidatorWorldMap = dynamic(() => import('@/components/ValidatorWorldMap'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] bg-[#0f0f0f]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
    </div>
  )
});

interface ValidatorLocation {
  city: string;
  country: string;
  coordinates: [number, number];
  count: number;
  provider?: string;
  monikers?: string[];
}

interface ValidatorLocation {
  city: string;
  country: string;
  coordinates: [number, number];
  count: number;
  provider?: string;
  monikers?: string[];
}

interface SuperNode {
  address: string;
  supernode_account?: string;
  version?: string;
  moniker: string;
  location: {
    country: string;
    city: string;
    lat: number;
    lng: number;
  };
  status: 'online' | 'offline';
  storage_total: number;
  storage_used: number;
  bandwidth: number;
  uptime: number;
}

interface ValidatorData {
  moniker: string;
  operator_address: string;
  jailed: boolean;
  status: string;
  tokens: string;
  voting_power: number;
}

interface CascadeFile {
  id: string;
  name: string;
  public: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tx_id: string;
  price: number;
  fee: number;
  size: number;
  last_modified: string;
}

export default function CascadePage() {
  const params = useParams();
  const chainName = params.chain as string;
  
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [supernodes, setSupernodes] = useState<SuperNode[]>([]);
  const [validatorLocations, setValidatorLocations] = useState<ValidatorLocation[]>([]);
  const [myFiles, setMyFiles] = useState<CascadeFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SuperNode | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingSupernodes, setLoadingSupernodes] = useState(false);

  // Only show for Lumera chains
  const isLumeraChain = chainName?.includes('lumera');

  const handleSelectChain = (chain: ChainData) => {
    setSelectedChain(chain);
    window.location.href = `/${chain.chain_name.toLowerCase().replace(/\s+/g, '-')}/cascade`;
  };

  useEffect(() => {
    async function loadChainData() {
      const cachedChains = sessionStorage.getItem('chains');
      
      if (cachedChains) {
        const data = JSON.parse(cachedChains);
        setChains(data);
        
        const chain = chainName 
          ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
          : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
        
        if (chain) setSelectedChain(chain);
      } else {
        const response = await fetch('/api/chains');
        const data = await response.json();
        sessionStorage.setItem('chains', JSON.stringify(data));
        setChains(data);
        
        const chain = chainName 
          ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
          : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
        
        if (chain) setSelectedChain(chain);
      }
    }
    loadChainData();
  }, [chainName]);

  // Fetch supernodes from backend API
  useEffect(() => {
    if (isLumeraChain && selectedChain) {
      setLoadingSupernodes(true);
      
      // Fetch supernodes from backend cascade API
      fetch(`https://ssl.winsnip.xyz/api/cascade/supernodes?chain=${selectedChain.chain_name}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.supernodes) {
            const supernodesData: SuperNode[] = data.supernodes.map((node: any) => ({
              address: node.address,
              supernode_account: node.supernode_account,
              version: node.version,
              moniker: node.moniker,
              location: node.location,
              status: node.status,
              storage_total: node.storage_total,
              storage_used: node.storage_used,
              bandwidth: node.bandwidth,
              uptime: node.uptime
            }));

            setSupernodes(supernodesData);

            // Create validator locations for map (only include online nodes with valid coordinates)
            const locationMap = new Map<string, ValidatorLocation>();
            supernodesData.forEach(node => {
              // Skip offline nodes or nodes with unknown location (lat: 0, lng: 0) or "Unknown" country
              if (node.status !== 'online' || node.location.country === 'Unknown' || (node.location.lat === 0 && node.location.lng === 0)) {
                return;
              }

              const key = `${node.location.city}-${node.location.country}`;
              if (locationMap.has(key)) {
                const existing = locationMap.get(key)!;
                existing.count++;
                existing.monikers?.push(node.moniker);
              } else {
                locationMap.set(key, {
                  city: node.location.city,
                  country: node.location.country,
                  coordinates: [node.location.lng, node.location.lat],
                  count: 1,
                  monikers: [node.moniker]
                });
              }
            });

            setValidatorLocations(Array.from(locationMap.values()));
          }
          setLoadingSupernodes(false);
        })
        .catch(error => {
          console.error('Error fetching supernodes:', error);
          setLoadingSupernodes(false);
        });
    }
  }, [isLumeraChain, selectedChain]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    // TODO: Implement actual upload to cascade network
    console.log('Uploading files:', files);
    
    // Mock upload
    setTimeout(() => {
      const newFiles = files.map((file, i) => ({
        id: String(myFiles.length + i + 1),
        name: file.name,
        public: false,
        status: 'pending' as const,
        tx_id: '--',
        price: 0,
        fee: 0,
        size: file.size,
        last_modified: new Date().toISOString()
      }));
      
      setMyFiles([...myFiles, ...newFiles]);
      setUploading(false);
    }, 2000);
  };

  if (!isLumeraChain) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex">
        <Sidebar selectedChain={selectedChain} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header chains={chains} selectedChain={selectedChain} onSelectChain={handleSelectChain} />
          
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto text-center py-20">
              <h1 className="text-3xl font-bold mb-4">Cascade Not Available</h1>
              <p className="text-gray-400">
                Cascade storage is only available for Lumera chains (mainnet and testnet).
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={handleSelectChain} />
        
        <main className="flex-1 overflow-y-auto pt-8 pb-8">
          {/* Title Section */}
          <div className="mx-6 mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapPin className="w-6 h-6 text-blue-400" />
              Cascade Storage Network
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {supernodes.filter(n => n.status === 'online').length} active supernodes
            </p>
          </div>

          {/* World Map Section */}
          <div className="h-[400px] bg-[#0f0f0f] relative flex mx-6 mb-6 rounded-xl overflow-hidden border border-gray-800">
            {/* Map */}
            <div className="flex-1 relative">
              {/* Map will be rendered here */}
              {loadingSupernodes ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
                </div>
              ) : (
                <ValidatorWorldMap locations={validatorLocations} />
              )}
            </div>

            {/* Supernodes List Sidebar */}
            <div className="w-96 bg-[#0a0a0a] border-l border-gray-800 overflow-y-auto">
              <div className="p-4">
                {/* Stats Summary */}
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 mb-4 border border-blue-500/20">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-400">
                        {supernodes.filter(n => n.status === 'online').length}
                      </div>
                      <div className="text-xs text-gray-400">Online</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-400">
                        {supernodes.filter(n => n.status === 'offline').length}
                      </div>
                      <div className="text-xs text-gray-400">Offline</div>
                    </div>
                  </div>
                </div>

                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  Active Supernodes ({supernodes.filter(n => n.status === 'online').length})
                </h3>
                <div className="space-y-2">
                  {supernodes.filter(n => n.status === 'online').map((node, idx) => (
                    <div 
                      key={idx} 
                      className="bg-[#1a1a1a] rounded-md p-2.5 border border-gray-800 hover:border-blue-500/50 transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedNode(node);
                        setIsModalOpen(true);
                      }}
                    >
                      {/* Moniker */}
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="font-semibold text-xs text-blue-400 truncate flex-1">
                          {node.moniker}
                        </h4>
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></div>
                      </div>
                      
                      {/* Location */}
                      {node.location.country !== 'Unknown' && (
                        <div className="flex items-center gap-1.5 mb-2 text-[11px] text-gray-400">
                          <MapPin className="w-2.5 h-2.5" />
                          <span>{node.location.city}, {node.location.country}</span>
                        </div>
                      )}
                      
                      {/* Storage */}
                      <div className="text-[11px] text-gray-400 space-y-1">
                        <div className="flex justify-between">
                          <span>Storage:</span>
                          <span className="text-white">
                            {(node.storage_used / 1e9).toFixed(0)}GB / {(node.storage_total / 1e9).toFixed(0)}GB
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1">
                          <div 
                            className="bg-blue-500 h-1 rounded-full transition-all" 
                            style={{ width: `${(node.storage_used / node.storage_total) * 100}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span>Bandwidth:</span>
                          <span className="text-white">{node.bandwidth} Mbps</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {supernodes.filter(n => n.status === 'offline').length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-xs font-bold mb-2 flex items-center gap-1.5 text-gray-500">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                      Offline Nodes ({supernodes.filter(n => n.status === 'offline').length})
                    </h3>
                    <div className="space-y-1.5">
                      {supernodes.filter(n => n.status === 'offline').map((node, idx) => (
                        <div key={idx} className="bg-[#1a1a1a]/50 rounded-md p-2 border border-gray-800 opacity-60">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500 font-medium truncate flex-1">
                              {node.moniker}
                            </span>
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0"></div>
                          </div>
                          {node.location.country !== 'Unknown' && (
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                              <MapPin className="w-2.5 h-2.5" />
                              <span>{node.location.city}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Upload Section */}
          <div className="px-6">
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                isDragging 
                  ? 'border-blue-500 bg-blue-500/5' 
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-500" />
              <p className="text-sm mb-1 text-gray-300">
                {uploading ? 'Uploading...' : 'Drag & drop files here'}
              </p>
              <p className="text-xs text-gray-500 mb-2">or</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg cursor-pointer transition-all">
                <File className="w-3.5 h-3.5" />
                Browse Files
                <input 
                  type="file" 
                  className="hidden" 
                  multiple 
                  onChange={handleFileInput}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* My Files Section */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">My Files</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Types:</span>
                <select className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-1 text-sm">
                  <option>All</option>
                  <option>Public</option>
                  <option>Private</option>
                </select>
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#0f0f0f] border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">
                        <input type="checkbox" className="rounded" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Name</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Public</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">TX ID</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Fee</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase">Size</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Last Modified</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {myFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-[#0f0f0f] transition-colors">
                        <td className="px-4 py-3">
                          <input type="checkbox" className="rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <File className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-white">{file.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm text-gray-400">{file.public ? 'Yes' : 'No'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                            file.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                            file.status === 'in_progress' ? 'bg-blue-500/10 text-blue-400' :
                            file.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {file.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                            {file.status === 'in_progress' && <Clock className="w-3 h-3" />}
                            {file.status === 'failed' && <XCircle className="w-3 h-3" />}
                            {file.status === 'pending' && <Clock className="w-3 h-3" />}
                            {file.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-400">{file.tx_id}</td>
                        <td className="px-4 py-3 text-right text-sm text-white">{file.price}</td>
                        <td className="px-4 py-3 text-right text-sm text-white">{file.fee}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-400">
                          {file.size > 0 ? `${(file.size / 1024).toFixed(2)} KB` : '--'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {new Date(file.last_modified).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg text-xs font-medium transition-all">
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Detail Modal */}
      {isModalOpen && selectedNode && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-[#1a1a1a] rounded-xl border border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <h2 className="text-xl font-bold text-blue-400">{selectedNode.moniker}</h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Location */}
              {selectedNode.location.country !== 'Unknown' && (
                <div className="bg-[#0f0f0f] rounded-lg p-4 border border-gray-800">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <h3 className="font-semibold text-sm">Location</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 text-xs">City</div>
                      <div className="text-white mt-1">{selectedNode.location.city}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Country</div>
                      <div className="text-white mt-1">{selectedNode.location.country}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Latitude</div>
                      <div className="text-white mt-1">{selectedNode.location.lat.toFixed(4)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500 text-xs">Longitude</div>
                      <div className="text-white mt-1">{selectedNode.location.lng.toFixed(4)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Storage */}
              <div className="bg-[#0f0f0f] rounded-lg p-4 border border-gray-800">
                <div className="flex items-center gap-2 mb-3">
                  <HardDrive className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold text-sm">Storage</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Used</span>
                    <span className="text-white font-medium">{(selectedNode.storage_used / 1e9).toFixed(2)} GB</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total</span>
                    <span className="text-white font-medium">{(selectedNode.storage_total / 1e9).toFixed(2)} GB</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all" 
                      style={{ width: `${(selectedNode.storage_used / selectedNode.storage_total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    {((selectedNode.storage_used / selectedNode.storage_total) * 100).toFixed(2)}% used
                  </div>
                </div>
              </div>

              {/* Network */}
              <div className="bg-[#0f0f0f] rounded-lg p-4 border border-gray-800">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold text-sm">Network</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs">Bandwidth</div>
                    <div className="text-white mt-1">{selectedNode.bandwidth} Mbps</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Uptime</div>
                    <div className="text-white mt-1">{selectedNode.uptime}%</div>
                  </div>
                </div>
              </div>

              {/* Node Info */}
              <div className="bg-[#0f0f0f] rounded-lg p-4 border border-gray-800">
                <div className="flex items-center gap-2 mb-3">
                  <Server className="w-4 h-4 text-blue-400" />
                  <h3 className="font-semibold text-sm">Node Information</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs mb-2">Validator Address</div>
                    <div className="bg-black/50 rounded p-2 border border-gray-800">
                      <div className="text-blue-400 font-mono text-[11px] break-all leading-relaxed select-all">
                        {selectedNode.address || 'N/A'}
                      </div>
                    </div>
                  </div>
                  {selectedNode.supernode_account && (
                    <div>
                      <div className="text-gray-500 text-xs mb-2">Supernode Account</div>
                      <div className="bg-black/50 rounded p-2 border border-gray-800">
                        <div className="text-cyan-400 font-mono text-[11px] break-all leading-relaxed select-all">
                          {selectedNode.supernode_account}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    {selectedNode.version && (
                      <div>
                        <div className="text-gray-500 text-xs">Version</div>
                        <div className="text-white mt-1">{selectedNode.version}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-gray-500 text-xs">Status</div>
                      <div className="mt-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                          Online
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-[#1a1a1a] border-t border-gray-800 p-4 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
