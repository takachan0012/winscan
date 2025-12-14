'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { ArrowLeft, Coins, ExternalLink, Copy, Check, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';

interface DenomUnit {
  denom: string;
  exponent: number;
  aliases: string[];
}

interface AssetDetail {
  denom: string;
  metadata: {
    description: string;
    denom_units: DenomUnit[];
    base: string;
    display: string;
    name: string;
    symbol: string;
    uri: string;
    uri_hash: string;
  } | null;
  supply: string | null;
  supply_formatted: string;
  holders: number | null;
  holders_type: string;
  price: {
    usd: number;
    usd_24h_change: number;
    usd_market_cap: number;
  } | null;
}

export default function AssetDetailPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const chainName = params.chain as string;
  const denom = decodeURIComponent(params.denom as string);
  
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tokenLogo, setTokenLogo] = useState<string>('');

  useEffect(() => {
    async function loadChainData() {
      const response = await fetch('/chains.json');
      const data = await response.json();
      setChains(data);

      const chain = data.find((c: ChainData) => 
        c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase()
      ) || data[0];
      setSelectedChain(chain);
    }
    loadChainData();
  }, [chainName]);

  useEffect(() => {
    async function fetchAssetDetail() {
      if (!chainName || !denom) return;
      
      setLoading(true);
      try {
        // Check if denom is a PRC20 contract address (starts with paxi1)
        const isPRC20 = denom.startsWith('paxi1') && denom.length > 40;
        
        if (isPRC20) {
          // Fetch PRC20 token info
          const [tokenInfoRes, marketingInfoRes, holdersRes] = await Promise.all([
            fetch(`/api/prc20-token-detail?contract=${encodeURIComponent(denom)}&query=token_info`),
            fetch(`/api/prc20-token-detail?contract=${encodeURIComponent(denom)}&query=marketing_info`),
            fetch(`/api/prc20-token-detail?contract=${encodeURIComponent(denom)}&query=all_accounts`)
          ]);
          
          const tokenInfo = tokenInfoRes.ok ? await tokenInfoRes.json() : null;
          const marketingInfo = marketingInfoRes.ok ? await marketingInfoRes.json() : null;
          const holdersData = holdersRes.ok ? await holdersRes.json() : null;
          
          const numHolders = holdersData?.accounts?.length || 0;
          
          // Set logo URL
          if (marketingInfo?.logo?.url) {
            const logoUrl = marketingInfo.logo.url.startsWith('ipfs://')
              ? `https://ipfs.io/ipfs/${marketingInfo.logo.url.replace('ipfs://', '')}`
              : marketingInfo.logo.url;
            setTokenLogo(logoUrl);
          }
          
          if (tokenInfo) {
            // Transform PRC20 data to AssetDetail format
            setAsset({
              denom: denom,
              metadata: {
                description: marketingInfo?.description || 'PRC20 Token',
                denom_units: [
                  { denom: denom, exponent: 0, aliases: [] },
                  { denom: tokenInfo.symbol || 'TOKEN', exponent: tokenInfo.decimals || 6, aliases: [] }
                ],
                base: denom,
                display: tokenInfo.symbol || 'TOKEN',
                name: tokenInfo.name || marketingInfo?.project || 'Unknown',
                symbol: tokenInfo.symbol || 'TOKEN',
                uri: marketingInfo?.logo?.url || '',
                uri_hash: ''
              },
              supply: tokenInfo.total_supply || '0',
              supply_formatted: tokenInfo.total_supply 
                ? (Number(tokenInfo.total_supply) / Math.pow(10, tokenInfo.decimals || 6)).toLocaleString('en-US')
                : '0',
              holders: numHolders,
              holders_type: numHolders >= 100 ? 'estimated' : 'total_accounts',
              price: null
            });
          }
        } else {
          // Regular asset
          const response = await fetch(`/api/asset-detail?chain=${chainName}&denom=${encodeURIComponent(denom)}`);
          const data: AssetDetail = await response.json();
          
          if (data) {
            setAsset(data);
          }
        }
      } catch (error) {
        console.error('Error fetching asset detail:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAssetDetail();
  }, [chainName, denom]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSupply = (supply: string, exponent: number) => {
    if (!supply || supply === '0') return '0';
    
    try {
      const amount = BigInt(supply);
      const divisor = BigInt(10 ** exponent);

      const wholePart = amount / divisor;
      const remainder = amount % divisor;

      let displayAmount: string;
      
      if (exponent > 0) {
        const fractionalPart = remainder.toString().padStart(exponent, '0');
        const decimalValue = parseFloat(`${wholePart}.${fractionalPart}`);
        displayAmount = decimalValue.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        });
      } else {
        displayAmount = wholePart.toLocaleString('en-US');
      }
      
      return displayAmount;
    } catch (error) {
      return '-';
    }
  };

  const isNativeAsset = (base: string) => {
    return !base.startsWith('ibc/') && !base.startsWith('factory/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0a]">
        <Sidebar selectedChain={selectedChain} />
        <div className="flex-1">
          <Header 
            chains={chains}
            selectedChain={selectedChain} 
            onSelectChain={setSelectedChain}
          />
          <main className="p-6">
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0a]">
        <Sidebar selectedChain={selectedChain} />
        <div className="flex-1">
          <Header 
            chains={chains}
            selectedChain={selectedChain} 
            onSelectChain={setSelectedChain}
          />
          <main className="p-6">
            <div className="text-center py-12">
              <Coins className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">{t('assetDetail.notFound')}</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const displayUnit = asset.metadata?.denom_units.find((u: DenomUnit) => u.denom === asset.metadata?.display);
  const exponent = displayUnit ? displayUnit.exponent : 6;
  const isNative = isNativeAsset(asset.denom);
  const isPRC20 = asset?.holders_type === 'prc20';

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1">
        <Header 
          chains={chains}
          selectedChain={selectedChain} 
          onSelectChain={setSelectedChain}
        />
        
        <main className="p-4 md:p-6 pt-32 md:pt-24">
          {/* Back Button */}
          <Link 
            href={`/${chainName}/assets`}
            className="inline-flex items-center space-x-2 text-sm md:text-base text-gray-400 hover:text-white transition-colors mb-4 md:mb-6"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            <span>{t('assetDetail.backToAssets')}</span>
          </Link>

          {/* Header */}
          <div className="mb-4 md:mb-6">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="flex items-start gap-3 md:gap-4 flex-1">
                {/* Token Logo */}
                {tokenLogo && (
                  <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-orange-500/10 to-red-500/10 border-2 border-orange-500/30 flex-shrink-0 overflow-hidden">
                    <Image
                      src={tokenLogo}
                      alt={asset.metadata?.symbol || 'token'}
                      width={80}
                      height={80}
                      className="object-cover w-full h-full"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-orange-500"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div>';
                        }
                      }}
                    />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
                    <h1 className="text-xl md:text-3xl font-bold text-white truncate">
                      {asset.metadata?.name || asset.metadata?.symbol || t('assetDetail.title')}
                    </h1>
                    <span
                      className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold flex-shrink-0 ${
                        isPRC20
                          ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 text-orange-400 border border-orange-500/20'
                          : isNative
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}
                    >
                      {isPRC20 ? 'PRC20' : isNative ? t('assetDetail.native') : t('assetDetail.token')}
                    </span>
                  </div>
                  {asset.metadata?.description && (
                    <p className="text-sm md:text-base text-gray-400 max-w-3xl line-clamp-3 md:line-clamp-none">
                      {asset.metadata.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Price Card (if available) */}
          {asset.price && asset.price.usd > 0 && (
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg md:rounded-xl p-4 md:p-6 mb-4 md:mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">{t('assetDetail.currentPrice')}</div>
                  <div className="text-2xl md:text-4xl font-bold text-white mb-1 md:mb-2">
                    ${asset.price.usd < 0.01 
                      ? asset.price.usd.toFixed(8) 
                      : asset.price.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                    }
                  </div>
                  {asset.price.usd_24h_change !== 0 && (
                    <div className={`flex items-center gap-1 md:gap-2 text-sm md:text-lg font-bold ${
                      asset.price.usd_24h_change > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {asset.price.usd_24h_change > 0 ? '↑' : '↓'}
                      {Math.abs(asset.price.usd_24h_change).toFixed(2)}% (24h)
                    </div>
                  )}
                </div>
                {asset.price.usd_market_cap > 0 && (
                  <div className="text-left md:text-right">
                    <div className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">{t('assetDetail.marketCap')}</div>
                    <div className="text-xl md:text-2xl font-bold text-white">
                      ${asset.price.usd_market_cap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
            {/* Total Supply */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 md:p-6">
              <div className="text-xs md:text-sm text-gray-400 mb-1">{t('assetDetail.totalSupply')}</div>
              <div className="text-lg md:text-2xl font-bold text-white truncate">
                {asset.supply_formatted || formatSupply(asset.supply || '0', exponent)}
              </div>
              {asset.metadata?.symbol && (
                <div className="text-sm text-gray-500 mt-1">{asset.metadata.symbol}</div>
              )}
            </div>

            {/* Holders */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 md:p-6">
              <div className="text-xs md:text-sm text-gray-400 mb-1">{t('assetDetail.holders')}</div>
              <div className="text-lg md:text-2xl font-bold text-blue-400">
                {asset.holders && asset.holders > 0 
                  ? (asset.holders >= 100 ? '100+' : asset.holders.toLocaleString())
                  : '-'
                }
              </div>
              {asset.holders_type && asset.holders_type !== 'unavailable' && (
                <div className="text-[10px] md:text-xs text-gray-500 mt-1">
                  {asset.holders_type === 'estimated' ? 'Estimated' : asset.holders_type === 'total_accounts' ? t('assetDetail.totalAccounts') : t('assetDetail.estimated')}
                </div>
              )}
            </div>

            {/* Symbol */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 md:p-6">
              <div className="text-xs md:text-sm text-gray-400 mb-1">{t('assetDetail.symbol')}</div>
              <div className="text-lg md:text-2xl font-bold text-white truncate">
                {asset.metadata?.symbol || '-'}
              </div>
            </div>

            {/* Exponent */}
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-3 md:p-6">
              <div className="text-xs md:text-sm text-gray-400 mb-1">{t('assetDetail.decimals')}</div>
              <div className="text-lg md:text-2xl font-bold text-white">
                {exponent}
              </div>
            </div>
          </div>

          {/* Asset Information */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden mb-4 md:mb-6">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-800">
              <h2 className="text-lg md:text-xl font-bold text-white">{t('assetDetail.assetInfo')}</h2>
            </div>
            <div className="divide-y divide-gray-800">
              {/* Base Denom */}
              <div className="px-4 md:px-6 py-3 md:py-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs md:text-sm text-gray-400 mb-1">
                      {isPRC20 ? 'Contract Address' : t('assetDetail.baseDenom')}
                    </div>
                    <div className="text-xs md:text-sm text-white font-mono break-all overflow-hidden">
                      {asset.denom}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(asset.denom)}
                    className="p-1.5 md:p-2 text-gray-400 hover:text-white transition-colors flex-shrink-0 self-start"
                    title={t('assetDetail.copyToClipboard')}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Display Denom */}
              <div className="px-4 md:px-6 py-3 md:py-4">
                <div className="text-xs md:text-sm text-gray-400 mb-1">{t('assetDetail.displayDenom')}</div>
                <div className="text-xs md:text-sm text-white">
                  {asset.metadata?.display || '-'}
                </div>
              </div>

              {/* Name */}
              <div className="px-4 md:px-6 py-3 md:py-4">
                <div className="text-xs md:text-sm text-gray-400 mb-1">{t('assetDetail.name')}</div>
                <div className="text-xs md:text-sm text-white">
                  {asset.metadata?.name || '-'}
                </div>
              </div>

              {/* URI Hash */}
              {asset.metadata?.uri_hash && (
                <div className="px-4 md:px-6 py-3 md:py-4">
                  <div className="text-xs md:text-sm text-gray-400 mb-1">{t('assetDetail.uriHash')}</div>
                  <div className="text-xs md:text-sm text-white font-mono break-all">
                    {asset.metadata.uri_hash}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Denom Units */}
          {asset.metadata?.denom_units && asset.metadata.denom_units.length > 0 && (
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-800">
                <h2 className="text-lg md:text-xl font-bold text-white">{t('assetDetail.denomUnits')}</h2>
              </div>
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
                <table className="w-full">
                  <thead className="bg-[#0f0f0f] border-b border-gray-800">
                    <tr>
                      <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assetDetail.denom')}
                      </th>
                      <th className="px-3 md:px-6 py-2 md:py-3 text-left text-[10px] md:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assetDetail.exponent')}
                      </th>
                      <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {t('assetDetail.aliases')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {asset.metadata.denom_units.map((unit, index) => (
                      <tr key={index} className="hover:bg-[#0f0f0f] transition-colors">
                        <td className="px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm text-white font-mono">
                          {unit.denom}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm text-white">
                          {unit.exponent}
                        </td>
                        <td className="hidden md:table-cell px-6 py-4 text-sm text-gray-400">
                          {unit.aliases && unit.aliases.length > 0 
                            ? unit.aliases.join(', ') 
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Holders Section */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden mt-4 md:mt-6">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-white">Top Holders</h2>
              <Link
                href={`/${chainName}/assets/${encodeURIComponent(denom)}/holders`}
                className="text-xs md:text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                View All →
              </Link>
            </div>
            <div className="p-4 md:p-6">
              <div className="text-center py-6 md:py-8 text-gray-400">
                <p className="mb-3 md:mb-4 text-sm md:text-base">View detailed holder information</p>
                <Link
                  href={`/${chainName}/assets/${encodeURIComponent(denom)}/holders`}
                  className="inline-flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm md:text-base"
                >
                  <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                  <span>View Holders</span>
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

