'use client';
import { useState, useEffect } from 'react';
import { Wallet, X, Check, AlertCircle } from 'lucide-react';
import { ChainData } from '@/types/chain';
import { useWallet } from '@/contexts/WalletContext';
import {
  isKeplrInstalled,
  connectKeplr,
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
  const [walletType, setWalletType] = useState<'keplr' | 'metamask'>('keplr');
  const [bech32Address, setBech32Address] = useState<string>('');

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

  const handleConnect = async (selectedCoinType: 118 | 60, selectedWalletType: 'keplr' | 'metamask' = 'keplr') => {
    if (!selectedChain) {
      setError('Please select a chain first');
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    setShowModal(false);
    
    try {
      if (selectedWalletType === 'metamask') {
        if (!isMetaMaskInstalled()) {
          setError('MetaMask extension is not installed. Please install it from https://metamask.io/');
          window.open('https://metamask.io/', '_blank');
          return;
        }
        
        const metaMaskAccount = await connectMetaMask(selectedChain);
        
        // Convert hex address to bech32 for Cosmos compatibility
        const prefix = selectedChain.addr_prefix || 'cosmos';
        const bech32Addr = await hexToBech32(metaMaskAccount.address, prefix);
        setBech32Address(bech32Addr);
        
        // Store as KeplrAccount format for compatibility
        const account = {
          address: bech32Addr,
          algo: 'ethsecp256k1' as const,
          pubKey: new Uint8Array(),
          isNanoLedger: false,
        };
        
        setAccount(account);
        setWalletType('metamask');
        setCoinType(60);
        saveMetaMaskAccount(metaMaskAccount);
        window.dispatchEvent(new CustomEvent('keplr_wallet_changed'));
        
      } else {
        // Keplr connection
        if (!isKeplrInstalled()) {
          setError('Keplr extension is not installed. Please install it from https://www.keplr.app/');
          window.open('https://www.keplr.app/', '_blank');
          return;
        }
        
        const connectedAccount = await connectKeplr(selectedChain, selectedCoinType);
        setAccount(connectedAccount);
        setWalletType('keplr');
        setCoinType(selectedCoinType);
        const chainId = selectedChain.chain_id || selectedChain.chain_name;
        saveKeplrAccount(connectedAccount, chainId, selectedCoinType);
        window.dispatchEvent(new CustomEvent('keplr_wallet_changed'));
      }
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setError(err.message || `Failed to connect to ${selectedWalletType === 'metamask' ? 'MetaMask' : 'Keplr'}`);
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
    setShowModal(true);
    setError(null);
  };
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 10)}...${address.slice(-6)}`;
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
          <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <code className="text-sm text-gray-300 font-mono">
                {account && formatAddress(account.address)}
              </code>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                {walletType === 'metamask' ? 'MetaMask' : `Type ${coinType}`}
              </span>
            </div>
            <button
              onClick={handleDisconnect}
              className="ml-2 p-1 hover:bg-gray-800 rounded transition-colors"
              title="Disconnect"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
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
      {}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowModal(false)}>
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="w-6 h-6 text-blue-400" />
                Connect Keplr Wallet
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Choose wallet for <span className="text-white font-medium">{selectedChain?.chain_name || 'this chain'}</span>
              {isEvmChain && <span className="block text-xs text-purple-400 mt-2 flex items-center gap-1">⚡ EVM-compatible chain detected</span>}
            </p>
            <div className="space-y-3">
              {/* MetaMask option for EVM chains */}
              {isEvmChain && (
                <button
                  onClick={() => handleConnect(60, 'metamask')}
                  disabled={isConnecting}
                  className="w-full p-4 bg-gradient-to-r from-orange-500/20 to-orange-600/20 hover:from-orange-500/30 hover:to-orange-600/30 border border-orange-500/50 hover:border-orange-400 rounded-xl transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-12 h-12 bg-orange-500/30 rounded-xl flex items-center justify-center group-hover:bg-orange-500/40 transition-all duration-300 group-hover:scale-110">
                      <span className="text-2xl">🦊</span>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-semibold">MetaMask</span>
                        <span className="text-xs bg-orange-500/30 text-orange-300 px-2 py-0.5 rounded-full">EVM Native</span>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        Connect with MetaMask for full EVM compatibility
                      </p>
                    </div>
                    <Check className="w-5 h-5 text-gray-600 group-hover:text-orange-400 transition-all duration-300 group-hover:scale-110" />
                  </div>
                </button>
              )}
              {/* Keplr Cosmos Standard */}
              <button
                onClick={() => handleConnect(118, 'keplr')}
                disabled={isConnecting}
                className="w-full p-4 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 rounded-xl transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:bg-blue-500/30 transition-all duration-300 group-hover:scale-110">
                    <svg viewBox="0 0 256 256" className="w-8 h-8">
                      <defs>
                        <linearGradient id="keplrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
                          <stop offset="100%" style={{ stopColor: '#60a5fa', stopOpacity: 1 }} />
                        </linearGradient>
                      </defs>
                      <circle cx="128" cy="128" r="120" fill="url(#keplrGrad)" />
                      <path d="M128 60 L180 100 L180 156 L128 196 L76 156 L76 100 Z" fill="white" opacity="0.9" />
                      <circle cx="128" cy="128" r="25" fill="url(#keplrGrad)" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">Keplr - Cosmos</span>
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">118</span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      Standard Cosmos SDK chains
                    </p>
                  </div>
                  <Check className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-all duration-300 group-hover:scale-110" />
                </div>
              </button>
              {/* Keplr EVM Compatible */}
              <button
                onClick={() => handleConnect(60, 'keplr')}
                disabled={isConnecting}
                className="w-full p-4 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 hover:border-purple-500 rounded-xl transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:bg-purple-500/30 transition-all duration-300 group-hover:scale-110">
                    <svg viewBox="0 0 256 256" className="w-8 h-8">
                      <defs>
                        <linearGradient id="keplrGradEvm" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" style={{ stopColor: '#a855f7', stopOpacity: 1 }} />
                          <stop offset="100%" style={{ stopColor: '#c084fc', stopOpacity: 1 }} />
                        </linearGradient>
                      </defs>
                      <circle cx="128" cy="128" r="120" fill="url(#keplrGradEvm)" />
                      <path d="M128 60 L180 100 L180 156 L128 196 L76 156 L76 100 Z" fill="white" opacity="0.9" />
                      <circle cx="128" cy="128" r="25" fill="url(#keplrGradEvm)" />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-semibold">Keplr - EVM</span>
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">60</span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      EVM-compatible chains
                    </p>
                  </div>
                  <Check className="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-all duration-300 group-hover:scale-110" />
                </div>
              </button>
            </div>
            <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
              <p className="text-xs text-gray-400 leading-relaxed">
                <strong className="text-gray-300">Note:</strong> {isEvmChain 
                  ? 'For EVM chains, MetaMask provides the best compatibility. Alternatively, use Keplr with coin type 60.'
                  : 'Most Cosmos chains use Keplr with coin type 118. Only select type 60 for EVM-compatible chains.'}
              </p>
            </div>
            <div className="mt-4 flex justify-center gap-6 text-xs">
              <a
                href="https://www.keplr.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-all duration-200 hover:scale-110 font-medium"
              >
                Get Keplr →
              </a>
              {isEvmChain && (
                <a
                  href="https://metamask.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-orange-300 transition-all duration-200 hover:scale-110 font-medium"
                >
                  Get MetaMask →
                </a>
              )}
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
