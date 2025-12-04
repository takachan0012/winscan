'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChainData } from '@/types/chain';
import { Activity, TrendingUp, Users, Sparkles, Zap, Network, ArrowRight, Search, Shield, BarChart3 } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import WinScanLogo from '@/components/WinScanLogo';
import Footer from '@/components/Footer';
import { fetchChainsWithCache } from '@/lib/chainsCache';

interface GitHubContributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
}

export default function Home() {
  const [chains, setChains] = useState<ChainData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contributors, setContributors] = useState<GitHubContributor[]>([]);
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);

  useEffect(() => {
    setMounted(true);
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 3000));

    Promise.all([
      fetchChainsWithCache(),
      minLoadTime
    ])
      .then(([data]) => {
        setChains(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading chains:', err);
        setLoading(false);
      });

    // Fetch GitHub contributors
    fetch('https://api.github.com/repos/winsnip-official/winscan/contributors')
      .then(res => res.json())
      .then(data => {
        console.log('Contributors data:', data); // Debug log
        if (Array.isArray(data)) {
          // Filter out invalid contributors and get top 12
          const validContributors = data
            .filter(c => c && c.login && c.avatar_url && c.html_url && c.contributions)
            .slice(0, 12);
          setContributors(validContributors);
        } else {
          console.error('Contributors API response is not an array:', data);
        }
      })
      .catch(err => console.error('Error fetching contributors:', err));
  }, []);

  const getPrettyName = (chainName: string) => {
    return chainName
      .replace(/-mainnet$/i, '')
      .replace(/-testnet$/i, '')
      .replace(/-test$/i, '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const mainnets = chains.filter(c => 
    c.chain_name.toLowerCase().includes('mainnet') || 
    (!c.chain_name.toLowerCase().includes('test'))
  );

  const testnets = chains.filter(c => 
    c.chain_name.toLowerCase().includes('test') && 
    !c.chain_name.toLowerCase().includes('mainnet')
  );

  const displayChains = searchQuery 
    ? chains.filter(c => 
        getPrettyName(c.chain_name).toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.assets?.[0]?.symbol?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chains;

  const displayMainnets = searchQuery ? displayChains.filter(c => mainnets.includes(c)) : mainnets;
  const displayTestnets = searchQuery ? displayChains.filter(c => testnets.includes(c)) : testnets;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Simple Black Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-black"></div>
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 0.6s ease-out;
          animation-fill-mode: both;
        }
        
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
        
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Header */}
      <header className="border-b border-gray-900 bg-black sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
              <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 flex items-center justify-center">
                <img src="/logo.svg" alt="WinScan Logo" className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-base sm:text-lg lg:text-xl font-bold group-hover:text-gray-300 transition-colors">
                  <span className="text-purple-500">
                    WinScan
                  </span>
                  <span className="text-white"> Explorer</span>
                </h1>
                <div className="h-px bg-gradient-to-r from-purple-500 via-blue-500 to-transparent my-0.5 sm:my-1"></div>
                <p className="text-gray-500 text-[10px] sm:text-xs">{t('home.subtitle')}</p>
              </div>
            </Link>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {!loading && chains.length > 0 && (
                <div className="hidden md:flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-gray-900 border border-gray-800 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span className="text-gray-400 text-xs sm:text-sm">{chains.length} Networks</span>
                </div>
              )}
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {loading ? (
          <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute inset-0">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
            </div>

            <div className="relative z-10">
              {/* Single rotating ring */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 border-t border-r border-gray-700 rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
              </div>
              
              {/* Subtle pulse ring */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-36 h-36 border border-gray-800 rounded-full animate-pulse"></div>
              </div>
              
              {/* Logo container */}
              <div className="relative z-10 w-28 h-28 flex items-center justify-center">
                <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-2xl p-6 shadow-2xl border border-gray-800 animate-float">
                  <img src="/logo.svg" alt="WinScan" className="w-16 h-16" />
                </div>
              </div>
            </div>
            
            {/* Loading text */}
            <div className="mt-16 text-center relative z-10">
              <h2 className="text-2xl font-semibold text-gray-300 mb-4">
                {t('home.loading')}
              </h2>
              
              {/* Simple dots */}
              <div className="flex items-center justify-center gap-2 mt-6">
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16 xl:py-24 relative">
              <div className="max-w-5xl mx-auto text-center">
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4 sm:mb-6 lg:mb-8 text-white leading-tight">
                  Blockchain Explorer for
                  <span className="block mt-2 sm:mt-3 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 text-transparent bg-clip-text">
                    Cosmos Ecosystem
                  </span>
                </h2>
                
                <p className="text-gray-400 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl mb-6 sm:mb-8 lg:mb-12 max-w-3xl mx-auto leading-relaxed px-4">
                  Explore and analyze blockchain data across multiple <span className="text-blue-400 font-semibold">Cosmos networks</span>
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Real-time Data</span>
                  </div>
                  <div className="hidden sm:block w-1 h-1 bg-gray-700 rounded-full"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span>Multi-Chain Support</span>
                  </div>
                  <div className="hidden sm:block w-1 h-1 bg-gray-700 rounded-full"></div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                    <span>Advanced Analytics</span>
                  </div>
                </div>
                
                <div className="mt-4 sm:mt-6 lg:mt-8 text-gray-500 text-xs sm:text-sm">
                  Developed by{' '}
                  <a 
                    href="https://t.me/winnodexx" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-purple-500 hover:text-purple-400 transition-colors font-semibold"
                  >
                    @winnodexx
                  </a>
                </div>
              </div>
            </section>

            {/* Partners Marquee Section */}
            <section className="container mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-20 overflow-hidden">
              <div className="max-w-7xl mx-auto">
                <div className="text-center mb-8 sm:mb-12 lg:mb-16">
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 sm:mb-3 tracking-tight">
                    Built on Trusted Infrastructure
                  </h3>
                  <div className="w-16 sm:w-20 lg:w-24 h-0.5 sm:h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto rounded-full"></div>
                </div>
                
                <div className="relative py-6 sm:py-8 lg:py-12">
                  <div className="absolute left-0 top-0 bottom-0 w-24 sm:w-32 lg:w-48 bg-gradient-to-r from-black via-black/80 to-transparent z-10"></div>
                  <div className="absolute right-0 top-0 bottom-0 w-24 sm:w-32 lg:w-48 bg-gradient-to-l from-black via-black/80 to-transparent z-10"></div>
                  
                  <div className="flex animate-scroll items-center">
                    {/* First set of logos */}
                    <div className="flex items-center justify-center gap-16 sm:gap-24 md:gap-32 lg:gap-40 px-8 sm:px-12 lg:px-20 flex-shrink-0">
                      {/* Netcup */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/netcup.jpeg" alt="Netcup" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* Hetzner */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/Hetzner.png" alt="Hetzner" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* AWS */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/aws.png" alt="AWS" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* Keplr */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/keplr.png" alt="Keplr" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* Cosmostation */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/Cosmostation.png" alt="Cosmostation" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* Leap */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/leap.png" alt="Leap" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* Paxi */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/paxi.png" alt="Paxi" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                    </div>
                    
                    {/* Duplicate set for seamless loop */}
                    <div className="flex items-center justify-center gap-16 sm:gap-24 md:gap-32 lg:gap-40 px-8 sm:px-12 lg:px-20 flex-shrink-0">
                      {/* Netcup */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/netcup.jpeg" alt="Netcup" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* Hetzner */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/Hetzner.png" alt="Hetzner" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* AWS */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/aws.png" alt="AWS" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* Keplr */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/keplr.png" alt="Keplr" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* Cosmostation */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/Cosmostation.png" alt="Cosmostation" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* Leap */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/leap.png" alt="Leap" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                      
                      {/* Paxi */}
                      <div className="flex items-center justify-center hover:scale-110 transition-all duration-500 opacity-80 hover:opacity-100 w-24 h-20 sm:w-32 sm:h-24 lg:w-48 lg:h-32">
                        <img src="/paxi.png" alt="Paxi" className="max-h-12 sm:max-h-16 lg:max-h-24 max-w-full object-contain filter brightness-90 hover:brightness-110 transition-all" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Features Section */}
            <section className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
              <div className="max-w-6xl mx-auto">
                <div className="text-center mb-8 sm:mb-10 lg:mb-12">
                  <h2 className="text-3xl font-bold text-white mb-3">
                    Powerful Features
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Everything you need to explore blockchain networks
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Real-time Monitoring */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-all"></div>
                    <div className="relative bg-gray-900 border border-gray-800 rounded-xl p-6 hover:bg-gray-800 hover:border-gray-700 transition-all">
                      <div className="p-3 bg-blue-500/10 rounded-lg w-fit mb-4">
                        <Activity className="w-6 h-6 text-blue-400" />
                      </div>
                      <h3 className="text-white font-semibold text-lg mb-2">Real-time Monitoring</h3>
                      <p className="text-gray-500 text-sm">Track blocks, transactions, and network activities in real-time across multiple chains.</p>
                    </div>
                  </div>

                  {/* Validator Analytics */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-all"></div>
                    <div className="relative bg-gray-900 border border-gray-800 rounded-xl p-6 hover:bg-gray-800 hover:border-gray-700 transition-all">
                      <div className="p-3 bg-purple-500/10 rounded-lg w-fit mb-4">
                        <BarChart3 className="w-6 h-6 text-purple-400" />
                      </div>
                      <h3 className="text-white font-semibold text-lg mb-2">Validator Analytics</h3>
                      <p className="text-gray-500 text-sm">Comprehensive validator performance metrics, uptime tracking, and delegation insights.</p>
                    </div>
                  </div>

                  {/* Multi-chain Support */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-all"></div>
                    <div className="relative bg-gray-900 border border-gray-800 rounded-xl p-6 hover:bg-gray-800 hover:border-gray-700 transition-all">
                      <div className="p-3 bg-green-500/10 rounded-lg w-fit mb-4">
                        <Network className="w-6 h-6 text-green-400" />
                      </div>
                      <h3 className="text-white font-semibold text-lg mb-2">Multi-chain Support</h3>
                      <p className="text-gray-500 text-sm">Explore data across {chains.length}+ blockchain networks from a single interface.</p>
                    </div>
                  </div>

                  {/* Governance */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-all"></div>
                    <div className="relative bg-gray-900 border border-gray-800 rounded-xl p-6 hover:bg-gray-800 hover:border-gray-700 transition-all">
                      <div className="p-3 bg-yellow-500/10 rounded-lg w-fit mb-4">
                        <Users className="w-6 h-6 text-yellow-400" />
                      </div>
                      <h3 className="text-white font-semibold text-lg mb-2">Governance Tracking</h3>
                      <p className="text-gray-500 text-sm">Monitor proposals, voting power, and community governance across networks.</p>
                    </div>
                  </div>

                  {/* Asset Management */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-all"></div>
                    <div className="relative bg-gray-900 border border-gray-800 rounded-xl p-6 hover:bg-gray-800 hover:border-gray-700 transition-all">
                      <div className="p-3 bg-cyan-500/10 rounded-lg w-fit mb-4">
                        <TrendingUp className="w-6 h-6 text-cyan-400" />
                      </div>
                      <h3 className="text-white font-semibold text-lg mb-2">Asset Management</h3>
                      <p className="text-gray-500 text-sm">Track token balances, transfers, and asset distributions across chains.</p>
                    </div>
                  </div>

                  {/* Advanced Search */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-red-500/5 rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-all"></div>
                    <div className="relative bg-gray-900 border border-gray-800 rounded-xl p-6 hover:bg-gray-800 hover:border-gray-700 transition-all">
                      <div className="p-3 bg-pink-500/10 rounded-lg w-fit mb-4">
                        <Search className="w-6 h-6 text-pink-400" />
                      </div>
                      <h3 className="text-white font-semibold text-lg mb-2">Advanced Search</h3>
                      <p className="text-gray-500 text-sm">Quickly find blocks, transactions, addresses, and validators with powerful search.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Contribution CTA Section */}
            <section className="container mx-auto px-6 py-16">
              <div className="max-w-6xl mx-auto">
                <div className="relative group max-w-3xl mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all"></div>
                  <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-gray-700 transition-all">
                    <div className="text-center">
                      <h3 className="text-2xl font-bold text-white mb-3">
                        Want to be a Contributor?
                      </h3>
                      
                      <p className="text-gray-400 text-sm mb-6">
                        Join our open-source community and help us build the future of blockchain exploration.
                      </p>
                      
                      <div className="flex flex-wrap justify-center gap-3">
                        <a
                          href="https://github.com/winsnip-official/winscan"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black font-medium rounded-lg hover:bg-gray-200 transition-all text-sm"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                          <span>Contribute on GitHub</span>
                        </a>
                        
                        <a
                          href="https://github.com/winsnip-official/winscan/issues"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-700 text-white font-medium rounded-lg hover:bg-gray-800 hover:border-gray-600 transition-all text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>View Issues</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Screenshot Showcase */}
            <section className="container mx-auto px-6 py-20">
              <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                  <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
                    Platform Screenshots
                  </h2>
                  <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                    Explore our powerful blockchain explorer interface
                  </p>
                </div>

                <div className="space-y-8">
                  {/* Large Featured Screenshot - Stats Section */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-500"></div>
                    <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all duration-300 shadow-2xl">
                      <div className="mb-4">
                        <h3 className="text-2xl font-bold text-white mb-2">Network Statistics Dashboard</h3>
                        <p className="text-gray-400">Real-time network statistics and comprehensive metrics across all supported chains</p>
                      </div>
                      <div className="relative overflow-hidden rounded-xl border border-gray-700 shadow-xl">
                        <img 
                          src="/dasbord.PNG" 
                          alt="Stats Section"
                          className="w-full h-auto transform group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Grid of 3 Screenshots */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Features Section */}
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-500"></div>
                      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all duration-300 shadow-xl h-full">
                        <div className="mb-3">
                          <h4 className="text-lg font-bold text-white mb-1">Features Overview</h4>
                          <p className="text-gray-400 text-sm">Comprehensive feature showcase</p>
                        </div>
                        <div className="relative overflow-hidden rounded-lg border border-gray-700">
                          <img 
                            src="/Global Node Distribution Network.PNG" 
                            alt="Features Section"
                            className="w-full h-auto transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* BC Relayers */}
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-500"></div>
                      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all duration-300 shadow-xl h-full">
                        <div className="mb-3">
                          <h4 className="text-lg font-bold text-white mb-1">BC Relayers</h4>
                          <p className="text-gray-400 text-sm">Cross-chain relay monitoring</p>
                        </div>
                        <div className="relative overflow-hidden rounded-lg border border-gray-700">
                          <img 
                            src="/BC Relayers.PNG" 
                            alt="BC Relayers"
                            className="w-full h-auto transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Validator Delegation */}
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-500"></div>
                      <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-all duration-300 shadow-xl h-full">
                        <div className="mb-3">
                          <h4 className="text-lg font-bold text-white mb-1">Validator Delegation</h4>
                          <p className="text-gray-400 text-sm">Staking and delegation insights</p>
                        </div>
                        <div className="relative overflow-hidden rounded-lg border border-gray-700">
                          <img 
                            src="/war-del.PNG" 
                            alt="Validator Delegation"
                            className="w-full h-auto transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Hero Section - Search and Networks */}
            <section className="container mx-auto px-6">
              <div className="max-w-6xl mx-auto">
                {/* Search Bar */}
                <div className="max-w-2xl mx-auto mb-12">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
                    <input
                      type="text"
                      placeholder="Search networks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-700 transition-colors"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Networks Grid */}
            <section className="container mx-auto px-4 sm:px-6 pb-8 sm:pb-12 lg:pb-16">
              <div className="space-y-8 sm:space-y-10 lg:space-y-12">
                {displayMainnets.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                        {t('home.mainnetNetworks')}
                      </h2>
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-gray-900 border border-gray-800 text-gray-400 text-xs sm:text-sm rounded-lg">
                        {displayMainnets.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                      {displayMainnets.map((chain) => {
                        const chainPath = chain.chain_name.toLowerCase().replace(/\s+/g, '-');
                        return (
                          <Link
                            key={chain.chain_name}
                            href={`/${chainPath}`}
                            className="group bg-gray-900 border border-gray-800 rounded-lg p-3 sm:p-4 hover:bg-gray-800 hover:border-gray-700 transition-all"
                          >
                            <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
                              <img 
                                src={chain.logo} 
                                alt={chain.chain_name}
                                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="56" height="56"%3E%3Ccircle cx="28" cy="28" r="28" fill="%236b7280"/%3E%3C/svg%3E';
                                }}
                              />
                              <div className="w-full">
                                <h3 className="font-medium text-white text-xs sm:text-sm truncate group-hover:text-gray-300 transition-colors">
                                  {getPrettyName(chain.chain_name)}
                                </h3>
                                <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">{chain.assets?.[0]?.symbol || 'N/A'}</p>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {displayTestnets.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white">
                        {t('home.testnetNetworks')}
                      </h2>
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-gray-900 border border-gray-800 text-gray-400 text-xs sm:text-sm rounded-lg">
                        {displayTestnets.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                      {displayTestnets.map((chain) => {
                        const chainPath = chain.chain_name.toLowerCase().replace(/\s+/g, '-');
                        return (
                          <Link
                            key={chain.chain_name}
                            href={`/${chainPath}`}
                            className="group bg-gray-900 border border-gray-800 rounded-lg p-3 sm:p-4 hover:bg-gray-800 hover:border-gray-700 transition-all"
                          >
                            <div className="flex flex-col items-center text-center gap-2 sm:gap-3">
                              <img 
                                src={chain.logo} 
                                alt={chain.chain_name}
                                className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="56" height="56"%3E%3Ccircle cx="28" cy="28" r="28" fill="%236b7280"/%3E%3C/svg%3E';
                                }}
                              />
                              <div className="w-full">
                                <h3 className="font-medium text-white text-xs sm:text-sm truncate group-hover:text-gray-300 transition-colors">
                                  {getPrettyName(chain.chain_name)}
                                </h3>
                                <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">{chain.assets?.[0]?.symbol || 'N/A'}</p>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {displayChains.length === 0 && searchQuery && (
                  <div className="text-center py-16">
                    <Search className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No networks found</h3>
                    <p className="text-gray-500">Try searching with different keywords</p>
                  </div>
                )}

                {chains.length === 0 && !loading && (
                  <div className="text-center py-16">
                    <Activity className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">{t('home.noNetworks')}</h3>
                    <p className="text-gray-500 mb-4">{t('home.noNetworksDesc')}</p>
                    <button 
                      onClick={() => window.location.reload()}
                      className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      {t('home.retry')}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Contributors Section */}
            <section className="container mx-auto px-6 py-16">
              <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                  <h2 className="text-3xl font-bold text-white mb-3">
                    Contributors
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Meet the amazing people who help build WinScan
                  </p>
                </div>
                
                {/* Contributors Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
                  {contributors.length > 0 ? (
                    contributors.map((contributor, index) => (
                      contributor && contributor.login && contributor.avatar_url ? (
                        <div key={contributor.login} className="relative group">
                          <div className={`absolute inset-0 bg-gradient-to-br ${
                            index % 7 === 0 ? 'from-blue-500/10 to-purple-500/10' :
                            index % 7 === 1 ? 'from-purple-500/10 to-pink-500/10' :
                            index % 7 === 2 ? 'from-pink-500/10 to-orange-500/10' :
                            index % 7 === 3 ? 'from-cyan-500/10 to-blue-500/10' :
                            index % 7 === 4 ? 'from-green-500/10 to-emerald-500/10' :
                            index % 7 === 5 ? 'from-yellow-500/10 to-orange-500/10' :
                            'from-amber-500/10 to-red-500/10'
                          } rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-all`}></div>
                          <a 
                            href={contributor.html_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative block bg-gray-900 border border-gray-800 rounded-xl p-4 hover:bg-gray-800 hover:border-gray-700 transition-all"
                          >
                            <div className="relative w-14 h-14 rounded-full mb-3 mx-auto ring-2 ring-gray-800 group-hover:ring-gray-700 transition-all overflow-hidden bg-gray-800">
                              <Image 
                                src={contributor.avatar_url}
                                alt={contributor.login}
                                width={56}
                                height={56}
                                className="object-cover"
                                unoptimized
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contributor.login)}&background=1f2937&color=9ca3af&size=56`;
                                }}
                              />
                            </div>
                            <h3 className="text-white font-semibold text-center mb-1 text-sm truncate">{contributor.login}</h3>
                            <p className="text-gray-500 text-xs text-center">{contributor.contributions || 0} commits</p>
                          </a>
                        </div>
                      ) : null
                    ))
                  ) : (
                    // Loading skeleton
                    Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
                        <div className="w-14 h-14 bg-gray-800 rounded-full mb-3 mx-auto"></div>
                        <div className="h-4 bg-gray-800 rounded mb-2"></div>
                        <div className="h-3 bg-gray-800 rounded w-2/3 mx-auto"></div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
