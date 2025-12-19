'use client';

import { useState } from 'react';
import { Flame, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { ChainData } from '@/types/chain';
import { burnPRC20Tokens } from '@/lib/prc20Actions';

interface BurnTokensSectionProps {
  chain: ChainData;
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    balance?: string;
  };
  onBurnComplete?: () => void;
}

export default function BurnTokensSection({ chain, token, onBurnComplete }: BurnTokensSectionProps) {
  const [burnAmount, setBurnAmount] = useState('');
  const [burning, setBurning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);

  const handleBurn = async () => {
    if (!burnAmount || parseFloat(burnAmount) <= 0) {
      alert('Please enter a valid amount to burn');
      return;
    }

    try {
      setBurning(true);
      setResult(null);

      // Convert to base units
      const amountInBaseUnits = Math.floor(parseFloat(burnAmount) * Math.pow(10, token.decimals)).toString();

      // Check balance
      if (token.balance) {
        const balanceBigInt = BigInt(token.balance);
        const burnBigInt = BigInt(amountInBaseUnits);
        
        if (burnBigInt > balanceBigInt) {
          alert('Insufficient balance to burn');
          setBurning(false);
          return;
        }
      }

      console.log('🔥 Burning tokens:', {
        amount: burnAmount,
        amountInBaseUnits: amountInBaseUnits,
        token: token.symbol
      });

      const burnResult = await burnPRC20Tokens(
        chain,
        token.address,
        amountInBaseUnits,
        `Burn ${burnAmount} ${token.symbol}`
      );

      setResult(burnResult);

      if (burnResult.success) {
        setBurnAmount('');
        // Refresh balance
        setTimeout(() => {
          if (onBurnComplete) {
            onBurnComplete();
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error('Burn error:', error);
      setResult({
        success: false,
        error: error.message || 'Failed to burn tokens'
      });
    } finally {
      setBurning(false);
    }
  };

  const handleSetMaxBurn = () => {
    if (token.balance) {
      const balanceHuman = parseFloat(token.balance) / Math.pow(10, token.decimals);
      setBurnAmount(balanceHuman.toString());
    }
  };

  const userBalance = token.balance 
    ? (parseFloat(token.balance) / Math.pow(10, token.decimals)).toFixed(6)
    : '0';

  return (
    <div className="space-y-4">
      <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">
            <strong>Warning:</strong> Burning tokens permanently destroys them and reduces total supply. 
            This action cannot be undone!
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Amount to Burn ({token.symbol})
          </label>
          <div className="relative mb-2">
            <input
              type="number"
              value={burnAmount}
              onChange={(e) => setBurnAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
              disabled={burning}
            />
            <button
              onClick={handleSetMaxBurn}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400 hover:text-red-300 font-medium"
              disabled={burning}
            >
              MAX
            </button>
          </div>
          
          {/* Percentage Slider */}
          {token.balance && (
            <div className="space-y-2 mb-2">
              <input
                type="range"
                min="0"
                max="100"
                value={
                  token.balance && parseFloat(burnAmount) > 0
                    ? Math.min(100, (parseFloat(burnAmount) / (parseFloat(token.balance) / Math.pow(10, token.decimals))) * 100)
                    : 0
                }
                onChange={(e) => {
                  const percentage = parseFloat(e.target.value);
                  const maxBalance = parseFloat(token.balance || '0') / Math.pow(10, token.decimals);
                  const newAmount = (maxBalance * percentage / 100).toString();
                  setBurnAmount(newAmount);
                }}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${
                    token.balance && parseFloat(burnAmount) > 0
                      ? Math.min(100, (parseFloat(burnAmount) / (parseFloat(token.balance) / Math.pow(10, token.decimals))) * 100)
                      : 0
                  }%, #374151 ${
                    token.balance && parseFloat(burnAmount) > 0
                      ? Math.min(100, (parseFloat(burnAmount) / (parseFloat(token.balance) / Math.pow(10, token.decimals))) * 100)
                      : 0
                  }%, #374151 100%)`
                }}
                disabled={burning}
              />
              <div className="flex justify-between text-xs">
                <button
                  onClick={() => {
                    const maxBalance = parseFloat(token.balance || '0') / Math.pow(10, token.decimals);
                    setBurnAmount((maxBalance * 0.25).toString());
                  }}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                  disabled={burning}
                >
                  25%
                </button>
                <button
                  onClick={() => {
                    const maxBalance = parseFloat(token.balance || '0') / Math.pow(10, token.decimals);
                    setBurnAmount((maxBalance * 0.5).toString());
                  }}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                  disabled={burning}
                >
                  50%
                </button>
                <button
                  onClick={() => {
                    const maxBalance = parseFloat(token.balance || '0') / Math.pow(10, token.decimals);
                    setBurnAmount((maxBalance * 0.75).toString());
                  }}
                  className="text-gray-400 hover:text-red-400 transition-colors"
                  disabled={burning}
                >
                  75%
                </button>
                <button
                  onClick={handleSetMaxBurn}
                  className="text-gray-400 hover:text-red-400 transition-colors font-medium"
                  disabled={burning}
                >
                  Max
                </button>
              </div>
            </div>
          )}
          
          <p className="text-xs text-gray-500 mt-1">
            Balance: {userBalance} {token.symbol}
          </p>
        </div>

        <button
          onClick={handleBurn}
          disabled={burning || !burnAmount || parseFloat(burnAmount) <= 0}
          className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {burning ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Burning...
            </>
          ) : (
            <>
              <Flame className="w-4 h-4" />
              Burn Tokens
            </>
          )}
        </button>


      </div>

      {/* Success/Error Modal - Same style as swap */}
      {result && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] px-4">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex flex-col items-center text-center space-y-6">
              {result.success ? (
                <>
                  {/* Success Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/50">
                      <Flame className="w-10 h-10 text-white animate-bounce-slow" />
                    </div>
                  </div>
                  
                  {/* Success Message */}
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Burn Successful!</h3>
                    <p className="text-gray-400">Tokens have been permanently destroyed</p>
                  </div>
                  
                  {/* Transaction Hash */}
                  {result.txHash && (
                    <div className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Transaction Hash</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-orange-400 font-mono break-all flex-1">
                          {result.txHash}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(result.txHash || '');
                          }}
                          className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                          title="Copy to clipboard"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 w-full pt-2">
                    <button
                      onClick={() => {
                        const chainPath = chain.chain_name.toLowerCase().replace(/\s+/g, '-');
                        window.open(`/${chainPath}/transactions/${result.txHash}`, '_blank');
                      }}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-red-700 hover:from-orange-700 hover:to-red-800 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/30"
                    >
                      View Transaction
                    </button>
                    <button
                      onClick={() => setResult(null)}
                      className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Error Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/50">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Error Message */}
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Burn Failed</h3>
                    <p className="text-gray-400 text-sm">{result.error || 'Transaction failed. Please try again.'}</p>
                  </div>
                  
                  {/* Close Button */}
                  <button
                    onClick={() => setResult(null)}
                    className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
