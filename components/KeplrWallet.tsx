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

interface KeplrWalletProps {
  selectedChain: ChainData | null;
}

export default function KeplrWallet({ selectedChain }: KeplrWalletProps) {
  const { account, isConnected, setAccount } = useWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coinType, setCoinType] = useState<118 | 60>(118);
  const [showModal, setShowModal] = useState(false);

  // Listen for trigger connect event
  useEffect(() => {
    const handleTriggerConnect = () => {
      if (!isConnected) {
        openCoinTypeModal();
      }
    };

    window.addEventListener('trigger_keplr_connect', handleTriggerConnect);
    return () => {
      window.removeEventListener('trigger_keplr_connect', handleTriggerConnect);
    };
  }, [isConnected]);

  const handleConnect = async (selectedCoinType: 118 | 60) => {
    if (!selectedChain) {
      setError('Please select a chain first');
      return;
    }
    if (!isKeplrInstalled()) {
      setError('Keplr extension is not installed. Please install it from https://www.keplr.app/');
      window.open('https://www.keplr.app/', '_blank');
      return;
    }
    setIsConnecting(true);
    setError(null);
    setShowModal(false);
    try {
      const connectedAccount = await connectKeplr(selectedChain, selectedCoinType);
      setAccount(connectedAccount);
      setCoinType(selectedCoinType);
      const chainId = selectedChain.chain_id || selectedChain.chain_name;
      saveKeplrAccount(connectedAccount, chainId, selectedCoinType);
      window.dispatchEvent(new CustomEvent('keplr_wallet_changed'));
    } catch (err: any) {
      console.error('Keplr connection error:', err);
      setError(err.message || 'Failed to connect to Keplr');
      setAccount(null);
    } finally {
      setIsConnecting(false);
    }
  };
  const handleDisconnect = () => {
    disconnectKeplr();
    setAccount(null);
    setError(null);
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
                Type {coinType}
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="w-6 h-6" />
                Connect Keplr Wallet
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Choose the coin type for {selectedChain?.chain_name || 'this chain'}
            </p>
            <div className="space-y-3">
              {}
              <button
                onClick={() => handleConnect(118)}
                disabled={isConnecting}
                className="w-full p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 rounded-lg transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                    <span className="text-blue-400 font-bold">118</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">Cosmos Standard</span>
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Recommended</span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Standard Cosmos SDK chains (ATOM, OSMO, JUNO, etc.)
                    </p>
                  </div>
                  <Check className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                </div>
              </button>
              {}
              <button
                onClick={() => handleConnect(60)}
                disabled={isConnecting}
                className="w-full p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-purple-500 rounded-lg transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                    <span className="text-purple-400 font-bold">60</span>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">EVM Compatible</span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Ethereum-compatible chains (Evmos, Injective, Canto, etc.)
                    </p>
                  </div>
                  <Check className="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-colors" />
                </div>
              </button>
            </div>
            <div className="mt-6 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
              <p className="text-xs text-gray-400">
                <strong className="text-gray-300">Note:</strong> Choose the coin type that matches your chain's configuration. 
                Most Cosmos chains use type 118. Only select type 60 if the chain explicitly supports EVM addresses.
              </p>
            </div>
            <div className="mt-4 text-center">
              <a
                href="https://www.keplr.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Don't have Keplr? Install here →
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
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
