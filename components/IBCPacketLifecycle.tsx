'use client';

import { useState, useEffect } from 'react';
import { Send, ArrowDown, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';

interface IBCPacketEvent {
  type: 'send' | 'receive' | 'acknowledge' | 'timeout';
  txHash: string;
  height: number;
  timestamp: string;
  chainId: string;
  chainName: string;
  packetData?: any;
  acknowledgement?: any;
  error?: string;
}

interface IBCPacketLifecycle {
  sequence: string;
  sourcePort: string;
  sourceChannel: string;
  destPort: string;
  destChannel: string;
  events: IBCPacketEvent[];
  status: 'pending' | 'acknowledged' | 'timeout' | 'error';
  errorDetails?: string;
}

interface IBCPacketLifecycleProps {
  chainName: string;
  txHash: string;
}

export default function IBCPacketLifecycle({ chainName, txHash }: IBCPacketLifecycleProps) {
  const [data, setData] = useState<IBCPacketLifecycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPacketLifecycle();
  }, [chainName, txHash]);

  const loadPacketLifecycle = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/ibc/packet/${txHash}?chain=${chainName}`
      );

      if (res.ok) {
        const packetData = await res.json();
        setData(packetData);
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Failed to load packet lifecycle');
      }
    } catch (err: any) {
      console.error('Error loading IBC packet lifecycle:', err);
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-300 font-semibold mb-2">Failed to Load IBC Packet</p>
        <p className="text-red-400/80 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-400">
        No IBC packet data available
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (data.status) {
      case 'acknowledged':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'timeout':
        return <Clock className="w-6 h-6 text-orange-500" />;
      default:
        return <Clock className="w-6 h-6 text-yellow-500" />;
    }
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'acknowledged':
        return 'from-green-500 to-emerald-600';
      case 'error':
        return 'from-red-500 to-rose-600';
      case 'timeout':
        return 'from-orange-500 to-amber-600';
      default:
        return 'from-yellow-500 to-orange-600';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'send':
        return <Send className="w-5 h-5" />;
      case 'receive':
        return <ArrowDown className="w-5 h-5" />;
      case 'acknowledge':
        return <CheckCircle2 className="w-5 h-5" />;
      case 'timeout':
        return <Clock className="w-5 h-5" />;
      default:
        return <Send className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              data.status === 'acknowledged' ? 'bg-green-500/20' :
              data.status === 'error' ? 'bg-red-500/20' :
              data.status === 'timeout' ? 'bg-orange-500/20' :
              'bg-yellow-500/20'
            }`}>
              {getStatusIcon()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">IBC Packet Lifecycle</h2>
              <p className="text-gray-400 text-sm">Sequence #{data.sequence}</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${
            data.status === 'acknowledged' ? 'bg-green-500/10 text-green-400 border border-green-500/30' :
            data.status === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
            data.status === 'timeout' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30' :
            'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
          }`}>
            {data.status.toUpperCase()}
          </div>
        </div>

        {data.errorDetails && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-semibold mb-1 text-sm">IBC Acknowledgement Error</p>
                <p className="text-red-300/80 text-sm">{data.errorDetails}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400 mb-1">Source</p>
            <p className="text-white font-mono">
              {data.sourcePort}/{data.sourceChannel}
            </p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Destination</p>
            <p className="text-white font-mono">
              {data.destPort}/{data.destChannel}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Packet Events Timeline</h3>
          
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-800"></div>
            
            <div className="space-y-6">
              {data.events.map((event, idx) => (
                <div key={idx} className="relative pl-14">
                  <div className={`absolute left-0 w-10 h-10 rounded-lg flex items-center justify-center text-white z-10 ${
                    event.type === 'send' ? 'bg-blue-500/20 border border-blue-500/30' :
                    event.type === 'receive' ? 'bg-purple-500/20 border border-purple-500/30' :
                    event.type === 'acknowledge' ? (event.error ? 'bg-red-500/20 border border-red-500/30' : 'bg-green-500/20 border border-green-500/30') :
                    'bg-orange-500/20 border border-orange-500/30'
                  }`}>
                    {getEventIcon(event.type)}
                  </div>

                  <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-semibold capitalize flex items-center gap-2 text-sm">
                        {event.type}
                        {event.error && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                            ERROR
                          </span>
                        )}
                      </h4>
                      <span className="text-gray-400 text-xs">
                        Block #{event.height}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex gap-2">
                        <span className="text-gray-400">Chain:</span>
                        <span className="text-purple-400">{event.chainName}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400">TX Hash:</span>
                        <span className="text-cyan-400 font-mono">{event.txHash.slice(0, 16)}...</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-400">Time:</span>
                        <span className="text-gray-300">{new Date(event.timestamp).toLocaleString()}</span>
                      </div>

                      {event.error && (
                        <div className="mt-3 pt-3 border-t border-red-500/30">
                          <p className="text-red-400 font-semibold mb-1">Error Details:</p>
                          <p className="text-red-300/80 text-xs">{event.error}</p>
                        </div>
                      )}

                      {event.acknowledgement && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <p className="text-gray-400 mb-1">Acknowledgement:</p>
                          <pre className="bg-gray-800 rounded p-2 text-xs text-gray-300 overflow-x-auto">
                            {JSON.stringify(event.acknowledgement, null, 2)}
                          </pre>
                        </div>
                      )}

                      {event.packetData && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <p className="text-gray-400 mb-1">Packet Data:</p>
                          <pre className="bg-gray-800 rounded p-2 text-xs text-gray-300 overflow-x-auto">
                            {JSON.stringify(event.packetData, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex gap-3">
          <Send className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-semibold mb-1 text-white">IBC Packet Lifecycle Explained</p>
            <p className="text-gray-400">
              IBC packets go through multiple stages: <strong>Send</strong> (initiated on source chain) → 
              <strong> Receive</strong> (received on destination chain) → 
              <strong> Acknowledge</strong> (confirmation back to source). 
              Unlike other explorers, we clearly show acknowledgement errors when they occur.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
