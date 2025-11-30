'use client';

import { useState, useEffect } from 'react';
import { Network, ArrowRight, Loader2, Link as LinkIcon } from 'lucide-react';

interface ChainMapping {
  chainId: string;
  chainName: string;
  denom: string;
  hash: string;
}

interface DenomTrace {
  path: string;
  baseDenom: string;
  hash?: string;
}

interface IBCDenomMappingData {
  denom: string;
  trace: DenomTrace;
  symbol?: string;
  name?: string;
  chainMappings: ChainMapping[];
}

interface IBCDenomMappingProps {
  chainName: string;
  denom: string;
}

export default function IBCDenomMapping({ chainName, denom }: IBCDenomMappingProps) {
  const [data, setData] = useState<IBCDenomMappingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMapping();
  }, [chainName, denom]);

  const loadMapping = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/ibc/denom-mapping?chain=${chainName}&denom=${encodeURIComponent(denom)}`
      );

      if (res.ok) {
        const mappingData = await res.json();
        setData(mappingData);
      }
    } catch (error) {
      console.error('Error loading IBC denom mapping:', error);
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

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-400">
        No IBC mapping data available
      </div>
    );
  }

  const isIBCDenom = denom.startsWith('ibc/');

  return (
    <div className="space-y-6">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <Network className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">IBC Denom Mapping</h2>
            <p className="text-gray-400 text-sm">
              {data.symbol || data.name || 'Token'} across chains
            </p>
          </div>
        </div>

        {isIBCDenom && data.trace && (
          <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 mb-6 space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-gray-400 min-w-[100px]">IBC Path:</span>
              <span className="text-white font-mono break-all">
                {data.trace.path || 'Direct transfer'}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 min-w-[100px]">Base Denom:</span>
              <span className="text-blue-400 font-mono">
                {data.trace.baseDenom}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-400 min-w-[100px]">IBC Hash:</span>
              <span className="text-gray-300 font-mono break-all">
                {data.trace.hash}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">
            Available on {data.chainMappings.length} chain{data.chainMappings.length !== 1 ? 's' : ''}
          </h3>

          <div className="grid grid-cols-1 gap-4">
            {data.chainMappings.map((mapping, idx) => (
              <div
                key={`${mapping.chainId}-${idx}`}
                className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <LinkIcon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{mapping.chainName}</h4>
                      <p className="text-gray-400 text-sm font-mono">{mapping.chainId}</p>
                    </div>
                  </div>
                  {mapping.chainName === chainName && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">
                      Current Chain
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 text-sm min-w-[80px]">Denom:</span>
                    <span className="text-cyan-400 font-mono text-sm break-all flex-1">
                      {mapping.denom}
                    </span>
                  </div>
                  {mapping.hash && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400 text-sm min-w-[80px]">Hash:</span>
                      <span className="text-purple-300 font-mono text-xs break-all flex-1">
                        {mapping.hash}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {data.chainMappings.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p>This token is only available on the current chain</p>
              <p className="text-sm mt-2">No IBC transfers detected</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex gap-3">
          <Network className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-semibold mb-1 text-white">About IBC Denom Mapping</p>
            <p className="text-gray-400">
              The same token can have different IBC hash denoms on different chains. 
              This mapping shows all chains where this token is available via IBC transfers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
