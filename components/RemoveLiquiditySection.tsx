'use client';

import { useState, useEffect } from 'react';
import { Minus, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { executeWithdrawLiquidity } from '@/lib/keplr';
import { ChainData } from '@/types/chain';

interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
  balance?: string;
}

interface RemoveLiquiditySectionProps {
  chainData: ChainData;
  paxiToken: Token;
  prc20Token: Token;
  walletAddress: string;
  onSuccess?: () => void;
  onResult?: (result: { success: boolean; txHash?: string; error?: string }) => void;
}

export default function RemoveLiquiditySection({
  chainData,
  paxiToken,
  prc20Token,
  walletAddress,
  onSuccess,
  onResult
}: RemoveLiquiditySectionProps) {
  const [lpAmount, setLpAmount] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<any>(null);
  const [poolData, setPoolData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    loadPosition();
    loadPoolData();
    // Auto-refresh setiap 10 detik
    const interval = setInterval(() => {
      loadPosition();
      loadPoolData();
    }, 10000);
    return () => clearInterval(interval);
  }, [walletAddress, prc20Token.address]);

  const loadPosition = async (retries = 3) => {
    setLoadingData(true);
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`🔄 Loading LP position (attempt ${i + 1}/${retries})...`);
        const response = await fetch(
          `https://mainnet-lcd.paxinet.io/paxi/swap/position/${walletAddress}/${prc20Token.address}`,
          { cache: 'no-store' }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        setPosition(data);
        console.log('✅ LP position loaded:', data);
        setLoadingData(false);
        return;
      } catch (error) {
        console.error(`❌ Position load attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }
    setLoadingData(false);
    console.error('❌ Failed to load position after all retries');
  };

  const loadPoolData = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`🔄 Loading pool data (attempt ${i + 1}/${retries})...`);
        const response = await fetch(
          `https://mainnet-lcd.paxinet.io/paxi/swap/pool/${prc20Token.address}`,
          { cache: 'no-store' }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        setPoolData(data);
        console.log('✅ Pool data loaded:', data);
        return;
      } catch (error) {
        console.error(`❌ Pool load attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }
    console.error('❌ Failed to load pool data after all retries');
  };

  const handlePercentageChange = (value: number) => {
    setPercentage(value);
    if (!position?.position?.lp_amount) return;
    
    const totalLp = parseFloat(position.position.lp_amount);
    const amount = (totalLp * value / 100).toFixed(0);
    setLpAmount(amount);
  };

  const handleRemoveLiquidity = async () => {
    if (!lpAmount || parseFloat(lpAmount) <= 0) {
      onResult?.({ success: false, error: 'Please enter a valid LP amount' });
      return;
    }

    setLoading(true);

    try {
      // Use the executeWithdrawLiquidity function from keplr.ts
      const result = await executeWithdrawLiquidity(
        chainData,
        {
          prc20Address: prc20Token.address,
          lpAmount: lpAmount
        },
        '500000',
        'Remove Liquidity via WinScan'
      );

      if (result.success) {
        onResult?.(result);
        setLpAmount('');
        setPercentage(0);
        setTimeout(() => {
          loadPosition();
          loadPoolData();
          onSuccess?.();
        }, 2000);
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (error: any) {
      console.error('Remove liquidity error:', error);
      onResult?.({ success: false, error: error.message || 'Failed to remove liquidity' });
    } finally {
      setLoading(false);
    }
  };

  const calculateExpectedAmounts = () => {
    if (!position || !lpAmount || !poolData) return { paxi: '0', prc20: '0' };

    const lpAmountNum = parseFloat(lpAmount);
    const totalShares = parseFloat(poolData.total_shares);
    const sharePercentage = lpAmountNum / totalShares;

    const expectedPaxi = (parseFloat(poolData.reserve_paxi) * sharePercentage) / 1e6;
    const expectedPrc20 = (parseFloat(poolData.reserve_prc20) * sharePercentage) / Math.pow(10, prc20Token.decimals);

    return {
      paxi: expectedPaxi.toFixed(6),
      prc20: expectedPrc20.toFixed(6)
    };
  };

  const expected = calculateExpectedAmounts();

  return (
    <div className="space-y-6">
      {/* Position Info */}
      {position?.position ? (
        <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Your Position</h3>
            <button
              onClick={() => {
                loadPosition();
                loadPoolData();
              }}
              disabled={loadingData}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 flex items-center gap-1"
            >
              {loadingData ? (
                <>
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : (
                'Refresh'
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400 text-xs mb-1">LP Shares</div>
              <div className="text-white font-semibold">
                {(parseFloat(position.position.lp_amount) / 1e6).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Share of Pool</div>
              <div className="text-white font-semibold">
                {poolData ? (
                  ((parseFloat(position.position.lp_amount) / parseFloat(poolData.total_shares)) * 100).toFixed(4)
                ) : '0'}%
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Pooled PAXI</div>
              <div className="text-white font-semibold">
                {(parseFloat(position.expected_paxi) / 1e6).toFixed(6)} PAXI
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Pooled {prc20Token.symbol}</div>
              <div className="text-white font-semibold">
                {(parseFloat(position.expected_prc20) / Math.pow(10, prc20Token.decimals)).toFixed(6)} {prc20Token.symbol}
              </div>
            </div>
          </div>
        </div>
      ) : loadingData ? (
        <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-400 text-sm">Loading your position...</p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-sm text-yellow-400 font-semibold">
                You don't have any liquidity in this pool yet
              </p>
              <p className="text-yellow-300/80 text-xs mt-1">
                Add liquidity first to see your position here.
              </p>
              <button
                onClick={() => loadPosition()}
                className="mt-2 px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 text-xs rounded transition-colors"
              >
                Retry Loading
              </button>
            </div>
          </div>
        </div>
      )}

      {position?.position && (
        <>
          {/* Percentage Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-400">Remove Percentage</label>
              <span className="text-sm text-white font-semibold">{percentage}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={percentage}
              onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #ef4444 0%, #ef4444 ${percentage}%, #374151 ${percentage}%, #374151 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          {/* LP Amount Input */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">LP Amount to Remove</label>
            <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
              <input
                type="number"
                value={lpAmount}
                onChange={(e) => setLpAmount(e.target.value)}
                placeholder="0"
                className="bg-transparent text-2xl text-white font-semibold focus:outline-none w-full"
              />
              <div className="mt-2 text-xs text-gray-400">
                Available: {(parseFloat(position.position.lp_amount) / 1e6).toFixed(2)} LP
              </div>
            </div>
          </div>

          {/* Expected Output */}
          {lpAmount && parseFloat(lpAmount) > 0 && (
            <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
              <div className="text-sm font-semibold text-white mb-3">You will receive:</div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">PAXI</span>
                  <span className="text-white font-semibold">{expected.paxi} PAXI</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">{prc20Token.symbol}</span>
                  <span className="text-white font-semibold">{expected.prc20} {prc20Token.symbol}</span>
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-400">
              <p className="font-semibold mb-1">Important:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Removing liquidity burns your LP tokens</li>
                <li>You will receive both PAXI and {prc20Token.symbol}</li>
                <li>Amounts are calculated based on current pool ratio</li>
              </ul>
            </div>
          </div>

          {/* Remove Liquidity Button */}
          <button
            onClick={handleRemoveLiquidity}
            disabled={loading || !lpAmount || parseFloat(lpAmount) <= 0}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-500 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Removing Liquidity...
              </>
            ) : (
              <>
                <Minus className="w-5 h-5" />
                Remove Liquidity
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
