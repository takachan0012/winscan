'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, ArrowRight, Copy, ExternalLink } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  executeIBCTransfer,
  formatIBCTransferCommand,
  estimateIBCFee,
  type IBCTransferParams,
} from '@/lib/ibcTransfer';
import { getAvailableDestinations, getIBCChannel } from '@/lib/ibcChannels';
import { getChainRegistryLogoUrl } from '@/lib/chainRegistryLogo';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceChain: string;
  prefilledToken?: {
    symbol: string;
    denom: string;
    balance?: string;
    logo?: string;
  };
  rpcEndpoint: string;
}

export default function TransferModal({
  isOpen,
  onClose,
  sourceChain,
  prefilledToken,
  rpcEndpoint,
}: TransferModalProps) {
  const { account, isConnected } = useWallet();
  const { language } = useLanguage();
  const address = account?.address;

  const [destChain, setDestChain] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showCommand, setShowCommand] = useState(false);
  const [loadingRecipient, setLoadingRecipient] = useState(false);

  const availableDestinations = getAvailableDestinations(sourceChain);
  const channel = destChain ? getIBCChannel(sourceChain, destChain) : null;
  const feeConfig = estimateIBCFee(sourceChain);

  useEffect(() => {
    if (availableDestinations.length > 0 && !destChain) {
      setDestChain(availableDestinations[0]);
    }
  }, [availableDestinations, destChain]);

  // Auto-detect recipient address when destination chain changes
  useEffect(() => {
    async function fetchRecipientAddress() {
      if (!destChain || !window.keplr) return;
      
      setLoadingRecipient(true);
      try {
        // Get user's address on destination chain
        await window.keplr.enable(destChain);
        const key = await window.keplr.getKey(destChain);
        setRecipient(key.bech32Address);
      } catch (err) {
        console.log('Could not auto-detect recipient address:', err);
        // User will need to input manually
      } finally {
        setLoadingRecipient(false);
      }
    }
    
    fetchRecipientAddress();
  }, [destChain]);

  const handleTransfer = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    if (!prefilledToken || !amount || !recipient || !destChain) {
      setError('Please fill in all required fields');
      return;
    }

    setIsProcessing(true);
    setError('');
    setTxHash('');

    // Convert amount to base unit (assuming 6 decimals for most tokens)
    const decimals = 6;
    const baseAmount = Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString();

    const params: IBCTransferParams = {
      sourceChain,
      destChain,
      token: {
        denom: prefilledToken.denom,
        amount: baseAmount,
      },
      recipientAddress: recipient,
      senderAddress: address,
      memo,
    };

    const result = await executeIBCTransfer(params, rpcEndpoint);

    if (result.success && result.txHash) {
      setTxHash(result.txHash);
      // Reset form
      setAmount('');
      setRecipient('');
      setMemo('');
    } else {
      setError(result.error || 'Transfer failed');
    }

    setIsProcessing(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-gray-700 shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">IBC Transfer</h2>
            <p className="text-sm text-gray-400 mt-1">
              Transfer tokens across chains via IBC
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Chain Route */}
          <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="text-center flex-1">
              <p className="text-xs text-gray-400 mb-1">From</p>
              <p className="font-semibold text-white capitalize">
                {sourceChain.replace(/-mainnet|-test/g, '')}
              </p>
            </div>
            <ArrowRight className="w-6 h-6 text-blue-400 mx-4" />
            <div className="text-center flex-1">
              <p className="text-xs text-gray-400 mb-1">To</p>
              <select
                value={destChain}
                onChange={(e) => setDestChain(e.target.value)}
                className="bg-gray-700 text-white rounded-lg px-3 py-1 text-sm border border-gray-600 focus:outline-none focus:border-blue-500"
              >
                {availableDestinations.map((chain) => (
                  <option key={chain} value={chain}>
                    {chain.replace(/-mainnet|-test/g, '')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Channel Info */}
          {channel && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
              <p className="text-blue-300">
                <span className="font-semibold">Channel:</span> {channel.channelId}
                {' → '}
                {channel.counterpartyChannelId}
              </p>
            </div>
          )}

          {/* Token & Amount */}
          {prefilledToken && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Token
                </label>
                <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3 border border-gray-700">
                  {prefilledToken.logo ? (
                    <Image
                      src={prefilledToken.logo}
                      alt={prefilledToken.symbol}
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full" />
                  )}
                  <div>
                    <p className="font-semibold text-white">{prefilledToken.symbol}</p>
                    {prefilledToken.balance && (
                      <p className="text-xs text-gray-400">
                        Balance: {parseFloat(prefilledToken.balance).toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.000001"
                  className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Recipient Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Recipient Address {loadingRecipient && <span className="text-blue-400">(auto-detecting...)</span>}
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={loadingRecipient ? "Loading your address..." : "cosmos1... (or leave blank for auto-detect)"}
              disabled={loadingRecipient}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 font-mono text-sm disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1">
              Your {destChain.replace(/-mainnet|-test/g, '')} address will be auto-filled
            </p>
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
              placeholder="Optional transfer memo"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Fee Info */}
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <p className="text-sm text-gray-300">
              <span className="font-semibold">Estimated Fee:</span>{' '}
              {parseFloat(feeConfig.amount) / 1_000_000} {feeConfig.denom.replace('u', '').toUpperCase()}
            </p>
            <p className="text-xs text-gray-400 mt-1">Gas: {feeConfig.gas}</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Success */}
          {txHash && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 space-y-2">
              <p className="text-sm text-green-300 font-semibold">Transfer Successful!</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-300 font-mono truncate flex-1">{txHash}</p>
                <button
                  onClick={() => copyToClipboard(txHash)}
                  className="p-1 hover:bg-green-500/20 rounded"
                >
                  <Copy className="w-4 h-4 text-green-400" />
                </button>
                <a
                  href={`/${sourceChain}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-green-500/20 rounded"
                >
                  <ExternalLink className="w-4 h-4 text-green-400" />
                </a>
              </div>
            </div>
          )}

          {/* CLI Command Reference */}
          <button
            onClick={() => setShowCommand(!showCommand)}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            {showCommand ? 'Hide' : 'Show'} CLI Command
          </button>

          {showCommand && prefilledToken && amount && recipient && (
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                {formatIBCTransferCommand({
                  sourceChain,
                  destChain,
                  token: {
                    denom: prefilledToken.denom,
                    amount: Math.floor(parseFloat(amount) * 1_000_000).toString(),
                  },
                  recipientAddress: recipient,
                  senderAddress: address || '<sender>',
                  memo,
                })}
              </pre>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleTransfer}
              disabled={isProcessing || !isConnected || !amount || !recipient}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all"
            >
              {isProcessing ? 'Processing...' : 'Transfer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
