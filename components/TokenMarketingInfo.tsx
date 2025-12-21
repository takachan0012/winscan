'use client';

import { useState, useEffect } from 'react';
import { Info, ExternalLink, Globe, Mail } from 'lucide-react';
import { queryMarketingInfo, queryMinterInfo } from '@/lib/prc20Actions';

interface TokenMarketingInfoProps {
  lcdUrl: string;
  contractAddress: string;
  tokenSymbol: string;
}

interface VolumeData {
  volume_24h: {
    paxi: number;
    usd: number;
  };
  current_price: {
    paxi: number;
    usd: number;
  };
}

export default function TokenMarketingInfo({ 
  lcdUrl, 
  contractAddress, 
  tokenSymbol 
}: TokenMarketingInfoProps) {
  const [marketingInfo, setMarketingInfo] = useState<any>(null);
  const [minterInfo, setMinterInfo] = useState<any>(null);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null);
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
      
      const [marketing, minter, tokenInfoRes, volumeRes] = await Promise.all([
        queryMarketingInfo(lcdUrl, contractAddress),
        queryMinterInfo(lcdUrl, contractAddress),
        fetch(tokenInfoUrl).then(res => res.json()).catch(() => null),
        fetch(`/api/prc20-volume/${contractAddress}`).then(res => res.json()).catch(() => null)
      ]);

      setMarketingInfo(marketing);
      setMinterInfo(minter);
      setTokenInfo(tokenInfoRes?.data);
      setVolumeData(volumeRes);
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

      <div className="space-y-3">
        {/* Liquidity */}
        {volumeData && tokenInfo && (
          <div className="py-3 border-b border-gray-700">
            <label className="text-sm text-gray-400 block mb-2">Liquidity</label>
            <p className="text-lg text-white font-medium">
              {volumeData.current_price.paxi > 0 ? (
                <>
                  {((volumeData.current_price.paxi * Number(tokenInfo.total_supply)) / Math.pow(10, tokenInfo.decimals || 6)).toLocaleString('en-US', { maximumFractionDigits: 2 })} PAXI
                </>
              ) : 'No liquidity data'}
            </p>
          </div>
        )}

        {/* Price */}
        {volumeData && (
          <div className="py-3 border-b border-gray-700">
            <label className="text-sm text-gray-400 block mb-2">Price</label>
            <p className="text-lg text-white font-medium">
              {volumeData.current_price.paxi.toFixed(8)} PAXI
            </p>
          </div>
        )}

        {/* Trading Volume */}
        {volumeData && (
          <div className="py-3 border-b border-gray-700">
            <label className="text-sm text-gray-400 block mb-2">Trading Volume</label>
            <p className="text-lg text-white font-medium">
              {volumeData.volume_24h.paxi > 0 
                ? `${volumeData.volume_24h.paxi.toLocaleString('en-US', { maximumFractionDigits: 2 })} PAXI`
                : 'No trading activity yet'}
            </p>
          </div>
        )}

        {/* Total Supply */}
        {tokenInfo && (
          <div className="py-3 border-b border-gray-700">
            <label className="text-sm text-gray-400 block mb-2">Total Supply</label>
            <p className="text-lg text-white font-medium">
              {tokenInfo.total_supply 
                ? (Number(tokenInfo.total_supply) / Math.pow(10, tokenInfo.decimals || 6)).toLocaleString('en-US', { 
                    maximumFractionDigits: 0
                  })
                : '0'}
            </p>
          </div>
        )}

        {/* Minting Permission */}
        {minterInfo !== null && (
          <div className="py-3 border-b border-gray-700">
            <label className="text-sm text-gray-400 block mb-2">Minting Permission</label>
            <p className={`text-lg font-medium ${!minterInfo || !minterInfo.minter ? 'text-green-400' : 'text-yellow-400'}`}>
              {!minterInfo || !minterInfo.minter 
                ? 'Freezing and minting have been revoked'
                : 'Minting is active'}
            </p>
            {minterInfo?.cap && (
              <p className="text-sm text-gray-500 mt-1">
                Max Supply Cap: {minterInfo.cap}
              </p>
            )}
          </div>
        )}

        {/* Description */}
        {marketingInfo?.description && (
          <div className="py-3 border-b border-gray-700">
            <label className="text-sm text-gray-400 block mb-2">Description</label>
            <p className="text-base text-gray-300 leading-relaxed">
              {marketingInfo.description}
            </p>
          </div>
        )}

        {/* Marketing Info Details */}
        {marketingInfo && (
          <div className="space-y-3 pt-2">
            {marketingInfo.project && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Project Name</label>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-500" />
                  <p className="text-sm text-white font-medium">{marketingInfo.project}</p>
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

        {/* Contract Address */}
        <div className="pt-3">
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

        {!marketingInfo && !minterInfo && !volumeData && (
          <p className="text-sm text-gray-500 text-center py-4">
            No additional token information available
          </p>
        )}
      </div>
    </div>
  );
}
