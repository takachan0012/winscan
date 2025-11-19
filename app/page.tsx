'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChainData } from '@/types/chain';
import { Activity, TrendingUp, Users, Sparkles, Zap, Network, ArrowRight, Search, Shield, BarChart3 } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import WinScanLogo from '@/components/WinScanLogo';
import Footer from '@/components/Footer';
import { fetchChainsWithCache } from '@/lib/chainsCache';

export default function Home() {
  const [chains, setChains] = useState<ChainData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);

  useEffect(() => {
    setMounted(true);
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 1500));

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
        c.assets[0]?.symbol?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chains;

  const displayMainnets = searchQuery ? displayChains.filter(c => mainnets.includes(c)) : mainnets;
  const displayTestnets = searchQuery ? displayChains.filter(c => testnets.includes(c)) : testnets;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col relative overflow-hidden">
      {/* Animated Background with Floating Logos */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        {/* Floating Chain Logos */}
        {!loading && chains.length > 0 && chains.slice(0, 10).map((chain, index) => (
          <div
            key={chain.chain_name}
            className="floating-logo"
            style={{
              left: `${10 + (index * 9)}%`,
              top: `${20 + (index % 5) * 15}%`,
              animationDelay: `${index * 0.5}s`,
              animationDuration: `${15 + (index % 5) * 2}s`,
              zIndex: 1
            }}
          >
            <img
              src={chain.logo}
              alt={chain.chain_name}
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full ring-2 ring-gray-800/30 shadow-2xl"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Ccircle cx="40" cy="40" r="40" fill="%236b7280"/%3E%3C/svg%3E';
              }}
            />
          </div>
        ))}
        
        {/* Flying Paxi Logos - Extra Animation Layer */}
        {!loading && chains.find(c => c.chain_name.toLowerCase().includes('paxi')) && (
          <>
            <div
              className="flying-paxi"
              style={{
                left: '5%',
                top: '10%',
                animationDelay: '0s',
                animationDuration: '20s'
              }}
            >
              <img
                src="https://file.winsnip.xyz/file/uploads/paxi.jpg"
                alt="Paxi"
                className="w-12 h-12 lg:w-16 lg:h-16 rounded-full ring-2 ring-purple-500/30 shadow-2xl"
              />
            </div>
            <div
              className="flying-paxi"
              style={{
                right: '15%',
                top: '30%',
                animationDelay: '5s',
                animationDuration: '25s'
              }}
            >
              <img
                src="https://file.winsnip.xyz/file/uploads/paxi.jpg"
                alt="Paxi"
                className="w-12 h-12 lg:w-16 lg:h-16 rounded-full ring-2 ring-purple-500/30 shadow-2xl"
              />
            </div>
            <div
              className="flying-paxi"
              style={{
                left: '70%',
                bottom: '20%',
                animationDelay: '10s',
                animationDuration: '22s'
              }}
            >
              <img
                src="https://file.winsnip.xyz/file/uploads/paxi.jpg"
                alt="Paxi"
                className="w-12 h-12 lg:w-16 lg:h-16 rounded-full ring-2 ring-purple-500/30 shadow-2xl"
              />
            </div>
            <div
              className="flying-paxi"
              style={{
                right: '35%',
                bottom: '15%',
                animationDelay: '15s',
                animationDuration: '28s'
              }}
            >
              <img
                src="https://file.winsnip.xyz/file/uploads/paxi.jpg"
                alt="Paxi"
                className="w-12 h-12 lg:w-16 lg:h-16 rounded-full ring-2 ring-purple-500/30 shadow-2xl"
              />
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
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
        
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 0.3;
          }
          25% {
            transform: translate(20px, -30px) rotate(5deg);
            opacity: 0.5;
          }
          50% {
            transform: translate(-10px, -50px) rotate(-3deg);
            opacity: 0.4;
          }
          75% {
            transform: translate(30px, -20px) rotate(7deg);
            opacity: 0.6;
          }
        }
        
        @keyframes fly-paxi {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            opacity: 0.4;
          }
          20% {
            transform: translate(100px, -80px) rotate(15deg) scale(1.1);
            opacity: 0.7;
          }
          40% {
            transform: translate(-50px, -120px) rotate(-10deg) scale(0.9);
            opacity: 0.5;
          }
          60% {
            transform: translate(120px, -60px) rotate(20deg) scale(1.15);
            opacity: 0.8;
          }
          80% {
            transform: translate(-80px, -100px) rotate(-15deg) scale(0.95);
            opacity: 0.6;
          }
          100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            opacity: 0.4;
          }
        }
        
        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        .animate-gradient-x {
          background-size: 200% auto;
          animation: gradient-x 3s ease infinite;
        }
        
        .floating-logo {
          position: absolute;
          animation: float linear infinite;
          opacity: 0.3;
          filter: blur(0.5px);
          transition: all 0.3s ease;
          z-index: 1;
        }
        
        .floating-logo:hover {
          opacity: 0.8 !important;
          filter: blur(0px);
          transform: scale(1.1);
          z-index: 10;
        }
        
        .flying-paxi {
          position: absolute;
          animation: fly-paxi ease-in-out infinite;
          opacity: 0.4;
          filter: blur(0.3px);
          transition: all 0.3s ease;
          z-index: 2;
          pointer-events: none;
        }
        
        .flying-paxi:hover {
          opacity: 0.9 !important;
          filter: blur(0px) drop-shadow(0 0 20px rgba(168, 85, 247, 0.6));
          transform: scale(1.2);
          z-index: 15;
          pointer-events: auto;
        }
        
        .aurora-line {
          position: absolute;
          width: 2px;
          height: 100%;
          background: linear-gradient(to bottom, transparent, #3b82f6, #8b5cf6, transparent);
          opacity: 0.4;
          filter: blur(1px);
          animation: aurora-move 8s ease-in-out infinite;
        }
        
        .aurora-1 {
          left: 20%;
          animation-delay: 0s;
        }
        
        .aurora-2 {
          left: 50%;
          height: 80%;
          animation-delay: 2s;
          background: linear-gradient(to bottom, transparent, #06b6d4, #3b82f6, transparent);
        }
        
        .aurora-3 {
          right: 20%;
          animation-delay: 4s;
          background: linear-gradient(to bottom, transparent, #8b5cf6, #ec4899, transparent);
        }
        
        @media (max-width: 768px) {
          .floating-logo {
            display: none;
          }
          
          .flying-paxi {
            display: none;
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 0.6s ease-out;
          animation-fill-mode: both;
        }
      `}</style>

      {/* Header */}
      <header className="border-b border-gray-800/30 backdrop-blur-xl bg-gradient-to-r from-black/50 via-gray-900/50 to-black/50 sticky top-0 z-50 shadow-xl shadow-black/20">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-4 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur-md opacity-0 group-hover:opacity-60 transition-all"></div>
                <div className="relative">
                  <WinScanLogo size="md" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-white group-hover:from-blue-400 group-hover:via-purple-400 group-hover:to-pink-400 transition-all">
                  {t('home.title')}
                </h1>
                <p className="text-gray-400 text-xs font-medium">{t('home.subtitle')}</p>
              </div>
            </Link>
            
            <div className="flex items-center gap-4">
              {!loading && chains.length > 0 && (
                <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-gray-900/60 to-gray-800/60 border border-gray-700/50 rounded-xl hover:border-green-500/30 transition-all group">
                  <div className="relative">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 bg-green-500 rounded-full blur-sm animate-pulse"></div>
                  </div>
                  <span className="text-gray-300 text-sm font-medium">{chains.length}</span>
                  <span className="text-gray-400 text-sm">Networks</span>
                </div>
              )}
              <div className="bg-gray-900/60 border border-gray-800/50 rounded-xl p-1 hover:border-gray-700 transition-all">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[600px]">
            <WinScanLogo size="xl" animated={true} />
            <p className="text-gray-500 mt-6 animate-pulse">{t('home.loading')}</p>
          </div>
        ) : (
          <>
            {/* Hero Section */}
            <section className="container mx-auto px-6 py-20 lg:py-32 relative">
              <div className="max-w-5xl mx-auto text-center relative z-10">
                <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 rounded-full mb-8 animate-fade-in hover:scale-105 transition-transform">
                  <WinScanLogo size="sm" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-sm font-semibold">Next-Gen Blockchain Explorer</span>
                </div>
                
                <h2 className="text-5xl lg:text-7xl font-bold mb-8 animate-slide-up leading-tight">
                  <span className="text-white">Reliable solutions for </span>
                  <span className="block mt-2">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 animate-gradient-x">
                      developing
                    </span>
                  </span>
                </h2>
                
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-12 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm hover:border-blue-500/30 transition-all">
                      <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-2">{chains.length}+</div>
                      <div className="text-gray-400 text-sm font-medium">Networks Supported</div>
                    </div>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm hover:border-green-500/30 transition-all">
                      <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 mb-2">{mainnets.length}+</div>
                      <div className="text-gray-400 text-sm font-medium">Mainnets</div>
                    </div>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gray-900/50 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm hover:border-purple-500/30 transition-all">
                      <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">99.9%</div>
                      <div className="text-gray-400 text-sm font-medium">High Uptime</div>
                    </div>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="max-w-3xl mx-auto mb-16 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all"></div>
                    <div className="relative">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" />
                      <input
                        type="text"
                        placeholder="Search networks by name or symbol..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-900/60 border border-gray-800/50 rounded-2xl pl-14 pr-6 py-5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-gray-900/80 hover:border-gray-700 transition-all backdrop-blur-md text-lg"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto animate-slide-up relative z-20" style={{ animationDelay: '0.3s' }}>
                  <div className="relative group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gradient-to-br from-gray-800/90 to-gray-800/70 border-2 border-gray-700/70 rounded-2xl p-8 backdrop-blur-sm hover:border-blue-500/50 transition-all group-hover:scale-105">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                        <Shield className="w-7 h-7 text-blue-400" />
                      </div>
                      <h3 className="text-white font-bold text-lg mb-3">Validator Monitoring</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">Track validator performance, uptime, and voting power in real-time with comprehensive metrics</p>
                    </div>
                  </div>

                  <div className="relative group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gradient-to-br from-gray-800/90 to-gray-800/70 border-2 border-gray-700/70 rounded-2xl p-8 backdrop-blur-sm hover:border-purple-500/50 transition-all group-hover:scale-105">
                      <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                        <BarChart3 className="w-7 h-7 text-purple-400" />
                      </div>
                      <h3 className="text-white font-bold text-lg mb-3">Network Analytics</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">Comprehensive blockchain metrics and statistics at your fingertips with detailed insights</p>
                    </div>
                  </div>

                  <div className="relative group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/30 to-orange-500/30 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gradient-to-br from-gray-800/90 to-gray-800/70 border-2 border-gray-700/70 rounded-2xl p-8 backdrop-blur-sm hover:border-pink-500/50 transition-all group-hover:scale-105">
                      <div className="w-14 h-14 bg-gradient-to-br from-pink-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                        <Zap className="w-7 h-7 text-pink-400" />
                      </div>
                      <h3 className="text-white font-bold text-lg mb-3">Real-time Updates</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">Live data synchronization with automatic refresh capabilities for up-to-date information</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Networks Grid */}
            <section className="container mx-auto px-6 pb-16">
              {/* Sponsors Section */}
              <div className="mb-16 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">Powered By</h2>
                  <p className="text-gray-400 text-sm">Our amazing partners</p>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-8 max-w-4xl mx-auto">
                  {/* Paxi Sponsor */}
                  <a
                    href="https://paxinet.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all"></div>
                    <div className="relative flex flex-col items-center gap-3 p-6 bg-gray-800/80 border-2 border-gray-700/70 rounded-2xl hover:border-purple-500/50 transition-all group-hover:scale-105">
                      <img
                        src="https://file.winsnip.xyz/file/uploads/paxi.jpg"
                        alt="Paxi"
                        className="w-20 h-20 rounded-full ring-2 ring-gray-800/50 group-hover:ring-purple-500/50 transition-all"
                      />
                      <div className="text-center">
                        <div className="text-base font-semibold text-white">Paxi</div>
                        <div className="text-xs text-gray-500">Network Partner</div>
                      </div>
                    </div>
                  </a>
                  
                  {/* Axone Sponsor */}
                  <a
                    href="https://axone.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 to-blue-500/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all"></div>
                    <div className="relative flex flex-col items-center gap-3 p-6 bg-gray-800/80 border-2 border-gray-700/70 rounded-2xl hover:border-purple-500/50 transition-all group-hover:scale-105">
                      <img
                        src="https://pbs.twimg.com/profile_images/1841523650043772928/EeZIYE7B_400x400.jpg"
                        alt="Axone"
                        className="w-20 h-20 rounded-full ring-2 ring-gray-800/50 group-hover:ring-purple-500/50 transition-all"
                      />
                      <div className="text-center">
                        <div className="text-base font-semibold text-white">Axone</div>
                        <div className="text-xs text-gray-500">Network Partner</div>
                      </div>
                    </div>
                  </a>
                  
                  {/* BitBadges Sponsor */}
                  <a
                    href="https://bitbadges.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all"></div>
                    <div className="relative flex flex-col items-center gap-3 p-6 bg-gray-800/80 border-2 border-gray-700/70 rounded-2xl hover:border-purple-500/50 transition-all group-hover:scale-105">
                      <img
                        src="https://pbs.twimg.com/profile_images/1948901739765084160/RdCGkJt4_400x400.jpg"
                        alt="BitBadges"
                        className="w-20 h-20 rounded-full ring-2 ring-gray-800/50 group-hover:ring-purple-500/50 transition-all"
                      />
                      <div className="text-center">
                        <div className="text-base font-semibold text-white">BitBadges</div>
                        <div className="text-xs text-gray-500">Network Partner</div>
                      </div>
                    </div>
                  </a>
                </div>
              </div>

              <div className="space-y-12">
                {displayMainnets.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <h2 className="text-2xl font-bold text-white">
                        {t('home.mainnetNetworks')}
                      </h2>
                      <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg font-medium">
                        {displayMainnets.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {displayMainnets.map((chain) => {
                        const chainPath = chain.chain_name.toLowerCase().replace(/\s+/g, '-');
                        return (
                          <Link
                            key={chain.chain_name}
                            href={`/${chainPath}`}
                            className="group bg-gray-800/70 border-2 border-gray-700/70 rounded-2xl p-5 hover:bg-gray-800/90 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all backdrop-blur-sm relative z-20"
                          >
                            <div className="flex items-center gap-3 mb-4">
                              <img 
                                src={chain.logo} 
                                alt={chain.chain_name}
                                className="w-12 h-12 rounded-full ring-2 ring-gray-800 group-hover:ring-blue-500/30 transition-all"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Ccircle cx="24" cy="24" r="24" fill="%236b7280"/%3E%3C/svg%3E';
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                                  {getPrettyName(chain.chain_name)}
                                </h3>
                                <p className="text-sm text-gray-500 font-mono">{chain.assets[0]?.symbol || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-gray-800/50">
                              <span className="text-xs text-gray-500">
                                <span className="text-gray-400 font-mono">{chain.addr_prefix}</span>
                              </span>
                              <ArrowRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {displayTestnets.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <h2 className="text-2xl font-bold text-white">
                        {t('home.testnetNetworks')}
                      </h2>
                      <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm rounded-lg font-medium">
                        {displayTestnets.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {displayTestnets.map((chain) => {
                        const chainPath = chain.chain_name.toLowerCase().replace(/\s+/g, '-');
                        return (
                          <Link
                            key={chain.chain_name}
                            href={`/${chainPath}`}
                            className="group bg-gray-800/70 border-2 border-gray-700/70 rounded-2xl p-5 hover:bg-gray-800/90 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all backdrop-blur-sm relative z-20"
                          >
                            <div className="flex items-center gap-3 mb-4">
                              <img 
                                src={chain.logo} 
                                alt={chain.chain_name}
                                className="w-12 h-12 rounded-full ring-2 ring-gray-800 group-hover:ring-purple-500/30 transition-all"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Ccircle cx="24" cy="24" r="24" fill="%236b7280"/%3E%3C/svg%3E';
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
                                  {getPrettyName(chain.chain_name)}
                                </h3>
                                <p className="text-sm text-gray-500 font-mono">{chain.assets[0]?.symbol || 'N/A'}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-gray-800/50">
                              <span className="text-xs text-gray-500">
                                <span className="text-gray-400 font-mono">{chain.addr_prefix}</span>
                              </span>
                              <ArrowRight className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
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
            <section className="container mx-auto px-6 py-20">
              <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                  <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4">
                    Meet Our{' '}
                    <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
                      Contributors
                    </span>
                  </h2>
                </div>
                
                {/* Contributors Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-4xl mx-auto">
                  {/* Contributor 1 - Izzy */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gray-800/80 border-2 border-gray-700/70 rounded-xl p-3 backdrop-blur-sm hover:border-blue-500/50 transition-all">
                      <img 
                        src="https://pbs.twimg.com/profile_images/1928087231681679361/p45PsuK7_400x400.jpg"
                        alt="Izzy"
                        className="w-12 h-12 rounded-full mb-2 mx-auto group-hover:scale-110 transition-transform ring-2 ring-blue-500/10 object-cover"
                      />
                      <h3 className="text-white font-semibold text-center mb-2 text-xs">Izzy</h3>
                      <div className="flex justify-center gap-2">
                        <a href="https://t.me/fitriay19" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/></svg>
                        </a>
                        <a href="https://x.com/Alikazz4" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        </a>
                        <a href="https://github.com/Mnuralim" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contributor 2 - OneNov */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gray-800/80 border-2 border-gray-700/70 rounded-xl p-3 backdrop-blur-sm hover:border-purple-500/50 transition-all">
                      <img 
                        src="https://avatars.githubusercontent.com/u/95606017?s=400&u=957ddaf67bfa7ad3320805f2771b7a8d8a6e52b2&v=4"
                        alt="OneNov"
                        className="w-12 h-12 rounded-full mb-2 mx-auto group-hover:scale-110 transition-transform ring-2 ring-purple-500/10 object-cover"
                      />
                      <h3 className="text-white font-semibold text-center mb-2 text-xs">OneNov</h3>
                      <div className="flex justify-center gap-2">
                        <a href="https://t.me/OneNov02" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/></svg>
                        </a>
                        <a href="https://x.com/Surya021292" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        </a>
                        <a href="https://github.com/OneNov0209" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contributor 3 - Taka */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-orange-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gray-800/80 border-2 border-gray-700/70 rounded-xl p-3 backdrop-blur-sm hover:border-pink-500/50 transition-all">
                      <img 
                        src="https://pbs.twimg.com/profile_images/1950568208395870208/Hs3mpiKR_400x400.jpg"
                        alt="Taka"
                        className="w-12 h-12 rounded-full mb-2 mx-auto group-hover:scale-110 transition-transform ring-2 ring-pink-500/10 object-cover"
                      />
                      <h3 className="text-white font-semibold text-center mb-2 text-xs">Taka</h3>
                      <div className="flex justify-center gap-2">
                        <a href="https://t.me/takadotdev" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/></svg>
                        </a>
                        <a href="https://x.com/kazutora_nichh" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        </a>
                        <a href="https://github.com/takachan0012" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-pink-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contributor 4 - jrisamsoee */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gray-800/80 border-2 border-gray-700/70 rounded-xl p-3 backdrop-blur-sm hover:border-cyan-500/50 transition-all">
                      <img 
                        src="https://pbs.twimg.com/profile_images/1962594449592365056/aO2zNYHl_400x400.jpg"
                        alt="Neira"
                        className="w-12 h-12 rounded-full mb-2 mx-auto group-hover:scale-110 transition-transform ring-2 ring-cyan-500/10 object-cover"
                      />
                      <h3 className="text-white font-semibold text-center mb-2 text-xs">Neira</h3>
                      <div className="flex justify-center gap-2">
                        <a href="https://t.me/jrisamsoee" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-cyan-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/></svg>
                        </a>
                        <a href="https://x.com/jrisamsoee" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-cyan-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        </a>
                        <a href="https://github.com/jrisamsoe" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-cyan-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contributor 5 - ZeroDevID */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gray-800/80 border-2 border-gray-700/70 rounded-xl p-3 backdrop-blur-sm hover:border-green-500/50 transition-all">
                      <img 
                        src="https://avatars.githubusercontent.com/u/44803987?v=4"
                        alt="ZeroDevID"
                        className="w-12 h-12 rounded-full mb-2 mx-auto group-hover:scale-110 transition-transform ring-2 ring-green-500/10 object-cover"
                      />
                      <h3 className="text-white font-semibold text-center mb-2 text-xs">ZeroDevID</h3>
                      <div className="flex justify-center gap-2">
                        <a href="https://t.me/ZeroDevID" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/></svg>
                        </a>
                        <a href="https://instagram.com/zero.developer" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                        </a>
                        <a href="https://github.com/zerodevid" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  {/* Contributor 6 - Jamal */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-0 group-hover:opacity-100"></div>
                    <div className="relative bg-gray-800/80 border-2 border-gray-700/70 rounded-xl p-3 backdrop-blur-sm hover:border-yellow-500/50 transition-all">
                      <img 
                        src="https://yt3.googleusercontent.com/SbJZAaRrhjIK0N9CcTpLoe5wkIlUSqzh6tmms2Ioiq1X6ojGhrXPHu3Bh_0Eh0gomSeUiFZJYA=s160-c-k-c0x00ffffff-no-rj"
                        alt="Jamal"
                        className="w-12 h-12 rounded-full mb-2 mx-auto group-hover:scale-110 transition-transform ring-2 ring-yellow-500/10 object-cover"
                      />
                      <h3 className="text-white font-semibold text-center mb-2 text-xs">Jamal</h3>
                      <div className="flex justify-center gap-2">
                        <a href="https://t.me/jamalsetiawan" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/></svg>
                        </a>
                        <a href="https://x.com/Bang_Satoshi" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        </a>
                        <a href="https://www.youtube.com/@BangSatoshi" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-yellow-400 transition-colors">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Contribution CTA */}
                <div className="mt-16 relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-2xl opacity-50 group-hover:opacity-100 transition-all"></div>
                  <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-gray-700/50 rounded-3xl p-12 backdrop-blur-sm hover:border-gray-600 transition-all">
                    <div className="text-center max-w-3xl mx-auto">
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6">
                        <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        <span className="text-blue-400 text-sm font-semibold">Open Source Project</span>
                      </div>
                      
                      <h3 className="text-3xl lg:text-4xl font-bold text-white mb-4">
                        Want to be a{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                          Contributor?
                        </span>
                      </h3>
                      
                      <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                        Join our open-source community and help us build the future of blockchain exploration.
                        All skill levels are welcome!
                      </p>
                      
                      <div className="flex flex-wrap justify-center gap-4">
                        <a
                          href="https://github.com/winsnip-official/winscan"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-purple-500 transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                          <span>Contribute on GitHub</span>
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </a>
                        
                        <a
                          href="https://github.com/winsnip-official/winscan/issues"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-8 py-4 bg-gray-800/60 border border-gray-700 text-white font-semibold rounded-xl hover:bg-gray-800 hover:border-gray-600 transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>View Issues</span>
                        </a>
                      </div>
                      
                      <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>Beginner Friendly</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                          </svg>
                          <span>Active Community</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          <span>Open Source</span>
                        </div>
                      </div>
                    </div>
                  </div>
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
