'use client';

import { useState } from 'react';
import { Send, CheckCircle, AlertCircle, X } from 'lucide-react';
import { transferPRC20Tokens } from '@/lib/prc20Actions';

interface TransferTokensSectionProps {
  token: {
    address: string;
    symbol: string;
    decimals: number;
    balance?: string;
  };
  chain: string;
  onTransferComplete?: () => void;
}

export default function TransferTokensSection({ 
  token, 
  chain,
  onTransferComplete 
}: TransferTokensSectionProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const handleMaxClick = () => {
    if (token.balance) {
      const balance = parseFloat(token.balance) / Math.pow(10, token.decimals);
      setAmount(balance.toString());
    }
  };

  const handleTransfer = async () => {
    if (!recipient || !amount) {
      setError('Please enter recipient address and amount');
      return;
    }

    // Validate address format
    if (!recipient.startsWith('paxi1')) {
      setError('Invalid address format. Must start with paxi1');
      return;
    }

    // Validate amount
    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setError('Invalid amount');
      return;
    }

    // Check balance
    if (token.balance) {
      const balance = parseFloat(token.balance) / Math.pow(10, token.decimals);
      if (transferAmount > balance) {
        setError(`Insufficient balance. Available: ${balance.toFixed(token.decimals)} ${token.symbol}`);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      // Convert amount to raw units
      const rawAmount = Math.floor(transferAmount * Math.pow(10, token.decimals)).toString();

      const result = await transferPRC20Tokens(
        chain,
        token.address,
        recipient,
        rawAmount,
        memo || undefined
      );

      if (result.success && result.txHash) {
        setTxHash(result.txHash);
        setShowModal(true);
        setRecipient('');
        setAmount('');
        setMemo('');
        
        if (onTransferComplete) {
          onTransferComplete();
        }
      } else {
        setError(result.error || 'Transfer failed');
      }
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const balance = token.balance 
    ? (parseFloat(token.balance) / Math.pow(10, token.decimals)).toFixed(token.decimals)
    : '0';

  return (
    <>
      <div className="space-y-6">
        {/* Recipient Address */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="paxi1..."
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Amount
          </label>
          <div className="relative mb-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="any"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
            <button
              onClick={handleMaxClick}
              className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium rounded transition-colors"
            >
              MAX
            </button>
          </div>
          
          {/* Percentage Slider */}
          {token.balance && (
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="100"
                value={
                  token.balance && parseFloat(amount) > 0
                    ? Math.min(100, (parseFloat(amount) / (parseFloat(token.balance) / Math.pow(10, token.decimals))) * 100)
                    : 0
                }
                onChange={(e) => {
                  const percentage = parseFloat(e.target.value);
                  const maxBalance = parseFloat(token.balance || '0') / Math.pow(10, token.decimals);
                  const newAmount = (maxBalance * percentage / 100).toString();
                  setAmount(newAmount);
                }}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-green"
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${
                    token.balance && parseFloat(amount) > 0
                      ? Math.min(100, (parseFloat(amount) / (parseFloat(token.balance) / Math.pow(10, token.decimals))) * 100)
                      : 0
                  }%, #374151 ${
                    token.balance && parseFloat(amount) > 0
                      ? Math.min(100, (parseFloat(amount) / (parseFloat(token.balance) / Math.pow(10, token.decimals))) * 100)
                      : 0
                  }%, #374151 100%)`
                }}
              />
              <div className="flex justify-between text-xs">
                <button
                  onClick={() => {
                    const maxBalance = parseFloat(token.balance || '0') / Math.pow(10, token.decimals);
                    setAmount((maxBalance * 0.25).toString());
                  }}
                  className="text-gray-400 hover:text-green-400 transition-colors"
                >
                  25%
                </button>
                <button
                  onClick={() => {
                    const maxBalance = parseFloat(token.balance || '0') / Math.pow(10, token.decimals);
                    setAmount((maxBalance * 0.5).toString());
                  }}
                  className="text-gray-400 hover:text-green-400 transition-colors"
                >
                  50%
                </button>
                <button
                  onClick={() => {
                    const maxBalance = parseFloat(token.balance || '0') / Math.pow(10, token.decimals);
                    setAmount((maxBalance * 0.75).toString());
                  }}
                  className="text-gray-400 hover:text-green-400 transition-colors"
                >
                  75%
                </button>
                <button
                  onClick={handleMaxClick}
                  className="text-gray-400 hover:text-green-400 transition-colors font-medium"
                >
                  Max
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Memo (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Memo (Optional)
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Add a note..."
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Transfer Button */}
        <button
          onClick={handleTransfer}
          disabled={loading || !recipient || !amount}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-green-500/30 disabled:shadow-none flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Transferring...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Transfer Tokens</span>
            </>
          )}
        </button>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-400">
              <p className="font-medium mb-1">Important:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-400/80">
                <li>Double-check the recipient address before sending</li>
                <li>Transactions cannot be reversed once confirmed</li>
                <li>A small gas fee will be deducted from your PAXI balance</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Transfer Successful!</h3>
                  <p className="text-sm text-gray-400">Your tokens have been sent</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1">Transaction Hash</div>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-green-400 font-mono break-all">{txHash}</code>
                  <button
                    onClick={() => copyToClipboard(txHash)}
                    className="flex-shrink-0 p-2 hover:bg-gray-700 rounded transition-colors"
                    title="Copy transaction hash"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <a
                  href={`https://www.mintscan.io/paxi/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium rounded-lg transition-colors text-center"
                >
                  View Transaction
                </a>
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
