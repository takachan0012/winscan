'use client';

import { useState, useEffect } from 'react';
import { Info, ExternalLink, Globe, Mail, FileText } from 'lucide-react';
import { queryMarketingInfo, queryMinterInfo } from '@/lib/prc20Actions';

interface TokenMarketingInfoProps {
  lcdUrl: string;
  contractAddress: string;
  tokenSymbol: string;
}

export default function TokenMarketingInfo({ 
  lcdUrl, 
  contractAddress, 
  tokenSymbol 
}: TokenMarketingInfoProps) {
  const [marketingInfo, setMarketingInfo] = useState<any>(null);
  const [minterInfo, setMinterInfo] = useState<any>(null);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInfo();
  }, [contractAddress]);

  const loadInfo = async () => {
    setLoading(true);
    try {
      // Query token_info for supply
      const tokenInfoQuery = btoa(JSON.stringify({ token_info: {} }));
      const tokenInfoUrl = `${lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${tokenInfoQuery}`;
      
      const [marketing, minter, tokenInfoRes] = await Promise.all([
        queryMarketingInfo(lcdUrl, contractAddress),
        queryMinterInfo(lcdUrl, contractAddress),
        fetch(tokenInfoUrl).then(res => res.json()).catch(() => null)
      ]);

      setMarketingInfo(marketing);
      setMinterInfo(minter);
      setTokenInfo(tokenInfoRes?.data);
    } catch (error) {
      console.error('Error loading token info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Token Information</h3>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Token Information</h3>
      </div>

      <div className="space-y-4">
        {/* Marketing Info */}
        {marketingInfo && (
          <div className="space-y-3">
            {marketingInfo.project && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Project Name</label>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-white font-medium">{marketingInfo.project}</p>
                </div>
              </div>
            )}

            {marketingInfo.description && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Description</label>
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-300">{marketingInfo.description}</p>
                </div>
              </div>
            )}

            {marketingInfo.marketing && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Marketing Contact</label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <a
                    href={`/${contractAddress.split('1')[0]}/address/${marketingInfo.marketing}`}
                    className="text-sm text-blue-400 hover:text-blue-300 font-mono"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {marketingInfo.marketing.slice(0, 12)}...{marketingInfo.marketing.slice(-8)}
                  </a>
                </div>
              </div>
            )}

            {marketingInfo.logo?.url && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Logo</label>
                <div className="flex items-center gap-2">
                  <img 
                    src={marketingInfo.logo.url} 
                    alt={`${tokenSymbol} logo`}
                    className="w-10 h-10 rounded-full"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <a
                    href={marketingInfo.logo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    View logo <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Token Supply */}
        {tokenInfo && (
          <div className="pt-3 border-t border-gray-700">
            <label className="text-xs text-gray-400 block mb-2">Total Supply</label>
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
              <p className="text-lg font-bold text-white">
                {tokenInfo.total_supply 
                  ? (Number(tokenInfo.total_supply) / Math.pow(10, tokenInfo.decimals || 6)).toLocaleString('en-US', { 
                      maximumFractionDigits: tokenInfo.decimals || 6 
                    })
                  : '0'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {tokenSymbol} • {tokenInfo.decimals || 6} decimals
              </p>
            </div>
          </div>
        )}

        {/* Minter Info */}
        {minterInfo && (
          <div className="pt-3 border-t border-gray-700">
            <label className="text-xs text-gray-400 block mb-2">Minter Address</label>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-300 font-mono break-all">
                {minterInfo.minter}
              </p>
            </div>
            {minterInfo.cap && (
              <p className="text-xs text-gray-500 mt-1">
                Max Supply Cap: {minterInfo.cap}
              </p>
            )}
          </div>
        )}

        {/* Contract Address */}
        <div className="pt-3 border-t border-gray-700">
          <label className="text-xs text-gray-400 block mb-2">Contract Address</label>
          <a
            href={`/${contractAddress.split('1')[0]}/address/${contractAddress}`}
            className="text-sm text-blue-400 hover:text-blue-300 font-mono break-all flex items-center gap-1"
            target="_blank"
            rel="noopener noreferrer"
          >
            {contractAddress}
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        </div>

        {!marketingInfo && !minterInfo && (
          <p className="text-sm text-gray-500 text-center py-4">
            No additional token information available
          </p>
        )}
      </div>
    </div>
  );
}
