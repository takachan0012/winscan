'use client';

import { useState, useEffect } from 'react';
import { Plus, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { executeProvideLiquidity } from '@/lib/keplr';
import { ChainData } from '@/types/chain';

interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
  balance?: string;
}

interface AddLiquiditySectionProps {
  chainData: ChainData;
  paxiToken: Token;
  prc20Token: Token;
  onSuccess?: () => void;
  onResult?: (result: { success: boolean; txHash?: string; error?: string }) => void;
}

export default function AddLiquiditySection({
  chainData,
  paxiToken,
  prc20Token,
  onSuccess,
  onResult
}: AddLiquiditySectionProps) {
  const [paxiAmount, setPaxiAmount] = useState('');
  const [prc20Amount, setPrc20Amount] = useState('');
  const [loading, setLoading] = useState(false);
  const [poolData, setPoolData] = useState<any>(null);
  const [loadingPool, setLoadingPool] = useState(false);

  // Load pool data with retry
  useEffect(() => {
    loadPoolData();
    // Auto-refresh pool data setiap 10 detik
    const interval = setInterval(() => {
      loadPoolData();
    }, 10000);
    return () => clearInterval(interval);
  }, [prc20Token.address]);

  const loadPoolData = async (retries = 3) => {
    setLoadingPool(true);
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
        setLoadingPool(false);
        return; // Success, exit
      } catch (error) {
        console.error(`❌ Pool load attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }
    setLoadingPool(false);
    console.error('❌ Failed to load pool data after all retries');
  };

  // Auto-calculate prc20 amount based on pool ratio
  const handlePaxiChange = (value: string) => {
    setPaxiAmount(value);
    
    if (!value || !poolData) {
      setPrc20Amount('');
      return;
    }

    const paxiInput = parseFloat(value);
    if (isNaN(paxiInput) || paxiInput <= 0) {
      setPrc20Amount('');
      return;
    }

    // Calculate ratio: prc20 = (paxi × reserve_prc20) / reserve_paxi
    const ratio = parseFloat(poolData.reserve_prc20) / parseFloat(poolData.reserve_paxi);
    const calculatedPrc20 = paxiInput * ratio;
    
    setPrc20Amount(calculatedPrc20.toFixed(6));
  };

  const handlePrc20Change = (value: string) => {
    setPrc20Amount(value);
    
    if (!value || !poolData) {
      setPaxiAmount('');
      return;
    }

    const prc20Input = parseFloat(value);
    if (isNaN(prc20Input) || prc20Input <= 0) {
      setPaxiAmount('');
      return;
    }

    // Calculate ratio: paxi = (prc20 × reserve_paxi) / reserve_prc20
    const ratio = parseFloat(poolData.reserve_paxi) / parseFloat(poolData.reserve_prc20);
    const calculatedPaxi = prc20Input * ratio;
    
    setPaxiAmount(calculatedPaxi.toFixed(6));
  };

  const handleAddLiquidity = async () => {
    if (!paxiAmount || !prc20Amount) {
      onResult?.({ success: false, error: 'Please enter both amounts' });
      return;
    }

    setLoading(true);

    try {
      // Convert amounts to base units
      const paxiBaseUnits = Math.floor(parseFloat(paxiAmount) * 1e6).toString();
      const prc20BaseUnits = Math.floor(parseFloat(prc20Amount) * Math.pow(10, prc20Token.decimals)).toString();

      // Use the executeProvideLiquidity function from keplr.ts
      const result = await executeProvideLiquidity(
        chainData,
        {
          prc20Address: prc20Token.address,
          prc20Amount: prc20BaseUnits,
          paxiAmount: paxiBaseUnits
        },
        '800000',
        'Add Liquidity via WinScan'
      );

      if (result.success) {
        onResult?.(result);
        setPaxiAmount('');
        setPrc20Amount('');
        setTimeout(() => {
          loadPoolData();
          onSuccess?.();
        }, 2000);
      } else {
        throw new Error(result.error || 'Transaction failed');
      }
    } catch (error: any) {
      console.error('Add liquidity error:', error);
      onResult?.({ success: false, error: error.message || 'Failed to add liquidity' });
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: string, decimals: number): string => {
    if (!balance || balance === '0') return '0.0000';
    return (Number(balance) / Math.pow(10, decimals)).toFixed(4);
  };

  return (
    <div className="space-y-6">
      {/* Pool Info */}
      {poolData && (
        <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Pool Information</h3>
            <button
              onClick={() => loadPoolData()}
              disabled={loadingPool}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 flex items-center gap-1"
            >
              {loadingPool ? (
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
              <div className="text-gray-400 text-xs mb-1">PAXI Reserve</div>
              <div className="text-white font-semibold">
                {(parseFloat(poolData.reserve_paxi) / 1e6).toFixed(2)} PAXI
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">{prc20Token.symbol} Reserve</div>
              <div className="text-white font-semibold">
                {(parseFloat(poolData.reserve_prc20) / Math.pow(10, prc20Token.decimals)).toFixed(2)} {prc20Token.symbol}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Price</div>
              <div className="text-white font-semibold">
                1 {prc20Token.symbol} = {parseFloat(poolData.price_paxi_per_prc20).toFixed(6)} PAXI
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs mb-1">Total LP Shares</div>
              <div className="text-white font-semibold">
                {(parseFloat(poolData.total_shares) / 1e6).toFixed(0)}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Loading Pool Data */}
      {!poolData && loadingPool && (
        <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-400 text-sm">Loading pool data...</p>
          </div>
        </div>
      )}

      {/* Pool Not Found */}
      {!poolData && !loadingPool && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-yellow-400 font-semibold text-sm">Pool data not available</p>
              <p className="text-yellow-300/80 text-xs mt-1">
                Click refresh to try loading pool data again.
              </p>
              <button
                onClick={() => loadPoolData()}
                className="mt-2 px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 text-xs rounded transition-colors"
              >
                Retry Loading
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Input Fields */}
      <div className="space-y-4">
        {/* PAXI Input */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-gray-400">PAXI Amount</label>
            {paxiToken.balance && (
              <button
                onClick={() => {
                  const maxAmount = formatBalance(paxiToken.balance || '0', 6);
                  handlePaxiChange(maxAmount);
                }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                MAX
              </button>
            )}
          </div>
          <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={paxiAmount}
                onChange={(e) => handlePaxiChange(e.target.value)}
                placeholder="0.0"
                className="bg-transparent text-2xl text-white font-semibold focus:outline-none w-full"
              />
              <div className="flex items-center gap-2 ml-4">
                <span className="text-white font-semibold">PAXI</span>
              </div>
            </div>
            {paxiToken.balance && (
              <div className="mt-2 text-xs text-gray-400">
                Balance: {formatBalance(paxiToken.balance, 6)} PAXI
              </div>
            )}
          </div>
        </div>

        {/* Plus Icon */}
        <div className="flex justify-center">
          <div className="p-2 bg-[#1a1a1a] border border-gray-800 rounded-full">
            <Plus className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* PRC20 Input */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm text-gray-400">{prc20Token.symbol} Amount</label>
            {prc20Token.balance && (
              <button
                onClick={() => {
                  const maxAmount = formatBalance(prc20Token.balance || '0', prc20Token.decimals);
                  handlePrc20Change(maxAmount);
                }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                MAX
              </button>
            )}
          </div>
          <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={prc20Amount}
                onChange={(e) => handlePrc20Change(e.target.value)}
                placeholder="0.0"
                className="bg-transparent text-2xl text-white font-semibold focus:outline-none w-full"
              />
              <div className="flex items-center gap-2 ml-4">
                <span className="text-white font-semibold">{prc20Token.symbol}</span>
              </div>
            </div>
            {prc20Token.balance && (
              <div className="mt-2 text-xs text-gray-400">
                Balance: {formatBalance(prc20Token.balance, prc20Token.decimals)} {prc20Token.symbol}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-400">
          <p className="font-semibold mb-1">Important:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>You will receive LP tokens representing your pool share</li>
            <li>Amounts are automatically calculated based on current pool ratio</li>
            <li>Make sure you have enough balance for both tokens</li>
          </ul>
        </div>
      </div>

      {/* Add Liquidity Button */}
      <button
        onClick={handleAddLiquidity}
        disabled={loading || !paxiAmount || !prc20Amount}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            Adding Liquidity...
          </>
        ) : (
          <>
            <Plus className="w-5 h-5" />
            Add Liquidity
          </>
        )}
      </button>
    </div>
  );
}
