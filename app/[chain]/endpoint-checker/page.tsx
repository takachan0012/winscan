'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { Activity, CheckCircle, XCircle, Clock, Loader2, Zap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface EndpointCheck {
  url: string;
  status: 'pending' | 'success' | 'error';
  latency?: number;
  error?: string;
  blockHeight?: string;
  chainId?: string;
}

export default function ToolsPage() {
  const params = useParams();
  const { language } = useLanguage();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  
  // Input states
  const [rpcUrl, setRpcUrl] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [grpcUrl, setGrpcUrl] = useState('');
  const [wssUrl, setWssUrl] = useState('');
  const [evmRpcUrl, setEvmRpcUrl] = useState('');
  const [evmWssUrl, setEvmWssUrl] = useState('');
  
  // Result states
  const [rpcResult, setRpcResult] = useState<EndpointCheck | null>(null);
  const [apiResult, setApiResult] = useState<EndpointCheck | null>(null);
  const [grpcResult, setGrpcResult] = useState<EndpointCheck | null>(null);
  const [wssResult, setWssResult] = useState<EndpointCheck | null>(null);
  const [evmRpcResult, setEvmRpcResult] = useState<EndpointCheck | null>(null);
  const [evmWssResult, setEvmWssResult] = useState<EndpointCheck | null>(null);
  
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = params?.chain as string;
      const chain = chainName 
        ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
        : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
      setSelectedChain(chain);
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
          setSelectedChain(chain);
        });
    }
  }, [params]);

  // Auto-fill endpoints when chain changes
  useEffect(() => {
    if (selectedChain) {
      // Fill Cosmos endpoints
      if (selectedChain.rpc && selectedChain.rpc.length > 0) {
        setRpcUrl(selectedChain.rpc[0].address);
        
        // Construct WSS from RPC if available
        const rpcAddr = selectedChain.rpc[0].address;
        const wssAddr = rpcAddr.replace('https://', 'wss://').replace('http://', 'ws://') + '/websocket';
        setWssUrl(wssAddr);
      }
      if (selectedChain.api && selectedChain.api.length > 0) {
        setApiUrl(selectedChain.api[0].address);
      }
      
      // gRPC usually uses same host as API but different port
      // We'll leave it empty for manual entry since it's not in ChainData
      setGrpcUrl('');
      
      // Fill EVM endpoints if available
      if (selectedChain.evm_rpc && selectedChain.evm_rpc.length > 0) {
        setEvmRpcUrl(selectedChain.evm_rpc[0].address);
      }
      if (selectedChain.evm_wss && selectedChain.evm_wss.length > 0) {
        setEvmWssUrl(selectedChain.evm_wss[0].address);
      }
    }
  }, [selectedChain]);

  const checkCosmosRPC = async (url: string): Promise<EndpointCheck> => {
    const startTime = Date.now();
    try {
      const response = await fetch(`${url}/status`, {
        signal: AbortSignal.timeout(10000)
      });
      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        return { url, status: 'error', latency, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      const blockHeight = data?.result?.sync_info?.latest_block_height;
      const chainId = data?.result?.node_info?.network;
      
      return {
        url,
        status: 'success',
        latency,
        blockHeight,
        chainId
      };
    } catch (error: any) {
      return {
        url,
        status: 'error',
        latency: Date.now() - startTime,
        error: error.name === 'TimeoutError' ? 'Timeout' : error.message
      };
    }
  };

  const checkCosmosAPI = async (url: string): Promise<EndpointCheck> => {
    const startTime = Date.now();
    try {
      const response = await fetch(`${url}/cosmos/base/tendermint/v1beta1/blocks/latest`, {
        signal: AbortSignal.timeout(10000)
      });
      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        return { url, status: 'error', latency, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      const blockHeight = data?.block?.header?.height;
      const chainId = data?.block?.header?.chain_id;
      
      return {
        url,
        status: 'success',
        latency,
        blockHeight,
        chainId
      };
    } catch (error: any) {
      return {
        url,
        status: 'error',
        latency: Date.now() - startTime,
        error: error.name === 'TimeoutError' ? 'Timeout' : error.message
      };
    }
  };

  const checkGRPC = async (url: string): Promise<EndpointCheck> => {
    const startTime = Date.now();
    try {
      // gRPC-web check using REST gateway
      const cleanUrl = url.replace('grpc://', 'https://').replace('grpc-web://', 'https://');
      const response = await fetch(`${cleanUrl}/cosmos/base/tendermint/v1beta1/node_info`, {
        signal: AbortSignal.timeout(10000)
      });
      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        return { url, status: 'error', latency, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      const chainId = data?.default_node_info?.network;
      
      return {
        url,
        status: 'success',
        latency,
        chainId
      };
    } catch (error: any) {
      return {
        url,
        status: 'error',
        latency: Date.now() - startTime,
        error: error.name === 'TimeoutError' ? 'Timeout' : error.message
      };
    }
  };

  const checkWebSocket = async (url: string): Promise<EndpointCheck> => {
    const startTime = Date.now();
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => {
          ws.close();
          resolve({
            url,
            status: 'error',
            latency: Date.now() - startTime,
            error: 'Connection timeout'
          });
        }, 10000);

        ws.onopen = () => {
          const latency = Date.now() - startTime;
          clearTimeout(timeout);
          ws.close();
          resolve({
            url,
            status: 'success',
            latency
          });
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          ws.close();
          resolve({
            url,
            status: 'error',
            latency: Date.now() - startTime,
            error: 'Connection failed'
          });
        };
      } catch (error: any) {
        resolve({
          url,
          status: 'error',
          latency: Date.now() - startTime,
          error: error.message
        });
      }
    });
  };

  const checkEVMRPC = async (url: string): Promise<EndpointCheck> => {
    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        }),
        signal: AbortSignal.timeout(10000)
      });
      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        return { url, status: 'error', latency, error: `HTTP ${response.status}` };
      }
      
      const data = await response.json();
      const blockHeight = data?.result ? parseInt(data.result, 16).toString() : undefined;
      
      // Get chainId
      const chainIdResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 2
        })
      });
      const chainIdData = await chainIdResponse.json();
      const chainId = chainIdData?.result ? parseInt(chainIdData.result, 16).toString() : undefined;
      
      return {
        url,
        status: 'success',
        latency,
        blockHeight,
        chainId
      };
    } catch (error: any) {
      return {
        url,
        status: 'error',
        latency: Date.now() - startTime,
        error: error.name === 'TimeoutError' ? 'Timeout' : error.message
      };
    }
  };

  const handleCheckAll = async () => {
    setChecking(true);
    
    // Reset all results to pending
    if (rpcUrl) setRpcResult({ url: rpcUrl, status: 'pending' });
    if (apiUrl) setApiResult({ url: apiUrl, status: 'pending' });
    if (grpcUrl) setGrpcResult({ url: grpcUrl, status: 'pending' });
    if (wssUrl) setWssResult({ url: wssUrl, status: 'pending' });
    if (evmRpcUrl) setEvmRpcResult({ url: evmRpcUrl, status: 'pending' });
    if (evmWssUrl) setEvmWssResult({ url: evmWssUrl, status: 'pending' });

    // Check all endpoints in parallel
    const promises = [];
    
    if (rpcUrl) promises.push(checkCosmosRPC(rpcUrl).then(setRpcResult));
    if (apiUrl) promises.push(checkCosmosAPI(apiUrl).then(setApiResult));
    if (grpcUrl) promises.push(checkGRPC(grpcUrl).then(setGrpcResult));
    if (wssUrl) promises.push(checkWebSocket(wssUrl).then(setWssResult));
    if (evmRpcUrl) promises.push(checkEVMRPC(evmRpcUrl).then(setEvmRpcResult));
    if (evmWssUrl) promises.push(checkWebSocket(evmWssUrl).then(setEvmWssResult));
    
    await Promise.all(promises);
    setChecking(false);
  };

  const renderResult = (result: EndpointCheck | null) => {
    if (!result) return null;
    
    return (
      <div className={`mt-3 p-4 rounded-lg border ${
        result.status === 'success' 
          ? 'bg-green-500/10 border-green-500/30' 
          : result.status === 'error'
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-blue-500/10 border-blue-500/30'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          {result.status === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : result.status === 'error' ? (
            <XCircle className="w-5 h-5 text-red-500" />
          ) : (
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          )}
          <span className={`font-medium ${
            result.status === 'success' ? 'text-green-400' :
            result.status === 'error' ? 'text-red-400' : 'text-blue-400'
          }`}>
            {result.status === 'success' ? 'Connected' : 
             result.status === 'error' ? 'Failed' : 'Checking...'}
          </span>
        </div>
        
        {result.latency !== undefined && (
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Clock className="w-4 h-4" />
            <span>Latency: {result.latency}ms</span>
          </div>
        )}
        
        {result.blockHeight && (
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Activity className="w-4 h-4" />
            <span>Block Height: {result.blockHeight}</span>
          </div>
        )}
        
        {result.chainId && (
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Zap className="w-4 h-4" />
            <span>Chain ID: {result.chainId}</span>
          </div>
        )}
        
        {result.error && (
          <div className="text-sm text-red-400 mt-2">
            Error: {result.error}
          </div>
        )}
      </div>
    );
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
          <div className="mb-4 md:mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center">
              <Activity className="w-6 h-6 md:w-8 md:h-8 mr-2 md:mr-3" />
              <span className="truncate">Endpoint Checker</span>
            </h1>
            <p className="text-gray-400">
              {selectedChain?.evm_rpc && selectedChain?.evm_wss && 
               selectedChain.evm_rpc.length > 0 && selectedChain.evm_wss.length > 0
                ? 'Test your Cosmos and EVM endpoints connectivity, latency, and status'
                : 'Test your Cosmos endpoints connectivity, latency, and status'
              }
            </p>
          </div>

          <div className="space-y-4 md:space-y-6">
            {/* Cosmos Endpoints */}
            <div className="bg-[#1a1a1a] rounded-lg p-4 md:p-6 border border-gray-800">
              <h2 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">Cosmos Endpoints</h2>
              
              <div className="space-y-4">
                {/* RPC */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Cosmos RPC
                  </label>
                  <input
                    type="text"
                    value={rpcUrl}
                    onChange={(e) => setRpcUrl(e.target.value)}
                    placeholder="https://rpc.example.com"
                    className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {renderResult(rpcResult)}
                </div>

                {/* API/REST */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Cosmos API/REST
                  </label>
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.example.com"
                    className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {renderResult(apiResult)}
                </div>

                {/* gRPC */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    gRPC / gRPC-Web
                  </label>
                  <input
                    type="text"
                    value={grpcUrl}
                    onChange={(e) => setGrpcUrl(e.target.value)}
                    placeholder="https://grpc.example.com or grpc://grpc.example.com:9090"
                    className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {renderResult(grpcResult)}
                </div>

                {/* WebSocket */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Cosmos WebSocket
                  </label>
                  <input
                    type="text"
                    value={wssUrl}
                    onChange={(e) => setWssUrl(e.target.value)}
                    placeholder="wss://rpc.example.com/websocket"
                    className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {renderResult(wssResult)}
                </div>
              </div>
            </div>

            {/* EVM Endpoints - Only show if chain supports EVM */}
            {selectedChain?.evm_rpc && selectedChain?.evm_wss && 
             selectedChain.evm_rpc.length > 0 && selectedChain.evm_wss.length > 0 && (
              <div className="bg-[#1a1a1a] rounded-lg p-4 md:p-6 border border-gray-800">
                <h2 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">EVM Endpoints</h2>
                
                <div className="space-y-4">
                  {/* EVM RPC */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      EVM JSON-RPC
                    </label>
                    <input
                      type="text"
                      value={evmRpcUrl}
                      onChange={(e) => setEvmRpcUrl(e.target.value)}
                      placeholder="https://evm.example.com"
                      className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    {renderResult(evmRpcResult)}
                  </div>

                  {/* EVM WebSocket */}
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      EVM WebSocket
                    </label>
                    <input
                      type="text"
                      value={evmWssUrl}
                      onChange={(e) => setEvmWssUrl(e.target.value)}
                      placeholder="wss://evm.example.com"
                      className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    {renderResult(evmWssResult)}
                  </div>
                </div>
              </div>
            )}

            {/* Check Button */}
            <div className="flex justify-center">
              <button
                onClick={handleCheckAll}
                disabled={checking || (!rpcUrl && !apiUrl && !grpcUrl && !wssUrl && !evmRpcUrl && !evmWssUrl)}
                className="w-full md:w-auto flex items-center justify-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors text-white font-medium text-base md:text-lg"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
                    <span className="truncate">Checking...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-5 h-5 md:w-6 md:h-6" />
                    <span className="truncate">Check All Endpoints</span>
                  </>
                )}
              </button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 md:p-4">
              <p className="text-blue-400 text-xs md:text-sm">
                💡 <strong>Tips:</strong> Enter one or more endpoints to test their connectivity, latency, and current status. 
                The tool will check if the endpoints are responding correctly and retrieve current block height and chain ID.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
