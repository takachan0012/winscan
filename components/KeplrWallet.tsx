'use client';
import { useState, useEffect } from 'react';
import { Wallet, X, Check, AlertCircle, Copy, LogOut } from 'lucide-react';
import { ChainData } from '@/types/chain';
import { useWallet } from '@/contexts/WalletContext';
import {
  isKeplrInstalled,
  isLeapInstalled,
  isCosmostationInstalled,
  connectKeplr,
  connectWalletWithType,
  disconnectKeplr,
  saveKeplrAccount,
} from '@/lib/keplr';
import {
  isMetaMaskInstalled,
  connectMetaMask,
  disconnectMetaMask,
  saveMetaMaskAccount,
  hexToBech32,
} from '@/lib/metamask';

interface KeplrWalletProps {
  selectedChain: ChainData | null;
}

export default function KeplrWallet({ selectedChain }: KeplrWalletProps) {
  const { account, isConnected, setAccount } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coinType, setCoinType] = useState<118 | 60>(118);
  const [showModal, setShowModal] = useState(false);
  const [walletType, setWalletType] = useState<'keplr' | 'leap' | 'cosmostation' | 'metamask'>('keplr');
  const [bech32Address, setBech32Address] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const isEvmChain = selectedChain && parseInt(selectedChain.coin_type || '118') === 60;

  // Listen for trigger connect event
  useEffect(() => {
    const handleTriggerConnect = () => {
      if (!isConnected) {
        if (selectedChain) {
          openCoinTypeModal();
        } else {
          setError('Please wait while chain is loading...');
          setTimeout(() => {
            if (selectedChain) {
              openCoinTypeModal();
              setError(null);
            }
          }, 1000);
        }
      }
    };

    window.addEventListener('trigger_keplr_connect', handleTriggerConnect);
    return () => {
      window.removeEventListener('trigger_keplr_connect', handleTriggerConnect);
    };
  }, [isConnected, selectedChain]);

  const handleConnect = async (selectedWalletType?: 'keplr' | 'leap' | 'cosmostation') => {
    if (!selectedChain) {
      setError('Please select a chain first');
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    setShowModal(false);
    
    try {
      const detectedCoinType = selectedChain.coin_type ? parseInt(selectedChain.coin_type) as (118 | 60) : 118;
      
      let walletToUse: 'keplr' | 'leap' | 'cosmostation' = 'keplr';
      
      if (!selectedWalletType) {
        if (isKeplrInstalled()) {
          walletToUse = 'keplr';
        } else if (isLeapInstalled()) {
          walletToUse = 'leap';
        } else if (isCosmostationInstalled()) {
          walletToUse = 'cosmostation';
        } else {
          setError('No wallet extension found. Please install Keplr, Leap, or Cosmostation.');
          window.open('https://www.keplr.app/', '_blank');
          return;
        }
      } else {
        walletToUse = selectedWalletType;
        
        if (selectedWalletType === 'leap' && !isLeapInstalled()) {
          setError('Leap extension is not installed. Please install it from https://www.leapwallet.io/');
          window.open('https://www.leapwallet.io/', '_blank');
          return;
        }
        
        if (selectedWalletType === 'cosmostation' && !isCosmostationInstalled()) {
          setError('Cosmostation extension is not installed. Please install it from https://cosmostation.io/');
          window.open('https://cosmostation.io/', '_blank');
          return;
        }
        
        if (selectedWalletType === 'keplr' && !isKeplrInstalled()) {
          setError('Keplr extension is not installed. Please install it from https://www.keplr.app/');
          window.open('https://www.keplr.app/', '_blank');
          return;
        }
      }
      
      const connectedAccount = await connectWalletWithType(selectedChain, detectedCoinType, walletToUse);
      setAccount(connectedAccount);
      setWalletType(walletToUse);
      setCoinType(detectedCoinType);
      const chainId = selectedChain.chain_id || selectedChain.chain_name;
      saveKeplrAccount(connectedAccount, chainId, detectedCoinType);
      window.dispatchEvent(new CustomEvent('keplr_wallet_changed'));
      
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setError(err.message || `Failed to connect wallet`);
      setAccount(null);
    } finally {
      setIsConnecting(false);
    }
  };
  
  const handleDisconnect = () => {
    if (walletType === 'metamask') {
      disconnectMetaMask();
    } else {
      disconnectKeplr();
    }
    setAccount(null);
    setError(null);
    setBech32Address('');
    window.dispatchEvent(new CustomEvent('keplr_wallet_changed'));
  };
  const openCoinTypeModal = () => {
    if (!selectedChain) {
      setError('Please select a chain first');
      return;
    }
    
    if (isKeplrInstalled() || isLeapInstalled() || isCosmostationInstalled()) {
      handleConnect();
    } else {
      setShowModal(true);
    }
    
    setError(null);
  };
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-6)}`;
  };

  const getWalletDisplayName = () => {
    if (walletType === 'metamask') return 'MetaMask';
    if (walletType === 'leap') return 'Leap';
    if (walletType === 'cosmostation') return 'Cosmostation';
    return 'Keplr';
  };

  const handleCopyAddress = async () => {
    if (account?.address) {
      try {
        await navigator.clipboard.writeText(account.address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {!isConnected ? (
          <button
            onClick={openCoinTypeModal}
            disabled={isConnecting || !selectedChain}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Wallet className="w-4 h-4" />
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <code className="text-sm text-gray-300 font-mono">
                {account && formatAddress(account.address)}
              </code>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                {getWalletDisplayName()}
              </span>
            </div>
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={handleCopyAddress}
                className="p-1.5 hover:bg-gray-800 rounded transition-colors group relative"
                title="Copy address"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-300" />
                )}
              </button>
              <button
                onClick={handleDisconnect}
                className="p-1.5 hover:bg-gray-800 rounded transition-colors group"
                title="Disconnect"
              >
                <LogOut className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-400" />
              </button>
            </div>
          </div>
        )}
      </div>
      {error && (
        <div className="fixed top-4 right-4 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg flex items-start gap-2 max-w-md z-50 animate-slide-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Connection Error</p>
            <p className="text-xs mt-1 text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-2 hover:bg-red-500/20 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Wallet Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-4" onClick={() => setShowModal(false)}>
          <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-gray-800 rounded-2xl p-8 max-w-2xl w-full shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                  Connect Wallet
                </h3>
                <p className="text-gray-400 text-sm">
                  Choose your preferred wallet to connect to <span className="text-blue-400 font-medium">{selectedChain?.chain_name}</span>
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-800 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 group"
              >
                <X className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
              </button>
            </div>
            
            {/* Wallet Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Keplr Wallet */}
              <button
                onClick={() => handleConnect('keplr')}
                disabled={isConnecting}
                className="relative p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 hover:from-blue-500/20 hover:to-blue-600/10 border border-blue-500/20 hover:border-blue-500/40 rounded-2xl transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-blue-500/20"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <img 
                      src="https://cdn.prod.website-files.com/667dc891bc7b863b5397495b/68a4ca95f93a9ab64dc67ab4_keplr-symbol.svg" 
                      alt="Keplr"
                      className="w-10 h-10"
                    />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-1">Keplr</h4>
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full mb-2 font-medium">Most Popular</span>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    The #1 Cosmos wallet
                  </p>
                </div>
                <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Check className="w-4 h-4 text-blue-400" />
                </div>
              </button>

              {/* Leap Wallet */}
              <button
                onClick={() => handleConnect('leap')}
                disabled={isConnecting}
                className="relative p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/5 hover:from-purple-500/20 hover:to-purple-600/10 border border-purple-500/20 hover:border-purple-500/40 rounded-2xl transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-purple-500/20"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <img 
                      src="https://pbs.twimg.com/profile_images/1771942341072318464/yrLlUePo_400x400.jpg" 
                      alt="Leap"
                      className="w-10 h-10 rounded-xl"
                    />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-1">Leap</h4>
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full mb-2 font-medium">Fast & Modern</span>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Super-fast wallet
                  </p>
                </div>
                <div className="absolute top-3 right-3 w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Check className="w-4 h-4 text-purple-400" />
                </div>
              </button>

              {/* Cosmostation Wallet */}
              <button
                onClick={() => handleConnect('cosmostation')}
                disabled={isConnecting}
                className="relative p-6 bg-gradient-to-br from-orange-500/10 to-orange-600/5 hover:from-orange-500/20 hover:to-orange-600/10 border border-orange-500/20 hover:border-orange-500/40 rounded-2xl transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-orange-500/20"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <img 
                      src="https://pbs.twimg.com/profile_images/1141994412450254849/nWwjGAZN_400x400.png" 
                      alt="Cosmostation"
                      className="w-10 h-10 rounded-xl object-contain"
                    />
                  </div>
                  <h4 className="text-white font-bold text-lg mb-1">Cosmostation</h4>
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full mb-2 font-medium">Trusted</span>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Cosmos ecosystem
                  </p>
                </div>
                <div className="absolute top-3 right-3 w-6 h-6 bg-orange-500/20 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Check className="w-4 h-4 text-orange-400" />
                </div>
              </button>
            </div>

            {/* Footer Links */}
            <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-800">
              <a
                href="https://www.keplr.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-blue-400 transition-colors flex items-center gap-2 group"
              >
                <span>Get Keplr</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a
                href="https://www.leapwallet.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-purple-400 transition-colors flex items-center gap-2 group"
              >
                <span>Get Leap</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a
                href="https://cosmostation.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-orange-400 transition-colors flex items-center gap-2 group"
              >
                <span>Get Cosmostation</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes scale-in {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </>
  );
}
