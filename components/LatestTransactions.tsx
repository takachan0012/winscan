'use client';
import { TransactionData, ChainAsset } from '@/types/chain';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
interface LatestTransactionsProps {
  transactions: TransactionData[];
  chainName: string;
  asset?: ChainAsset;
}
export default function LatestTransactions({ transactions, chainName, asset }: LatestTransactionsProps) {
  const [highlightedTxs, setHighlightedTxs] = useState<Set<string>>(new Set());
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  
  useEffect(() => {
    if (safeTransactions.length > 0) {
      const newTxs = safeTransactions.slice(0, 2).map(tx => tx.hash);
      setHighlightedTxs(new Set(newTxs));
      const timeout = setTimeout(() => {
        setHighlightedTxs(new Set());
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [safeTransactions]);
  const formatFee = (fee: string) => {
    if (!asset) return fee;
    const feeNum = parseFloat(fee) / Math.pow(10, Number(asset.exponent));
    return `${feeNum.toFixed(6)} ${asset.symbol}`;
  };
  const getTypeShortName = (type: string) => {
    const parts = type.split('.');
    return parts[parts.length - 1] || type;
  };
  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          {t('overview.latestTransactions')}
        </h3>
        <a href={`/${chainName}/transactions`} className="text-blue-500 hover:text-blue-400 text-sm">
          {t('overview.viewAllTransactions')} →
        </a>
      </div>
      <div className="space-y-3">
        {safeTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-sm">{t('common.loading')}</div>
          </div>
        ) : (
          safeTransactions.map((tx) => (
            <div
              key={tx.hash}
              className={`bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 hover:border-blue-500 transition-all duration-500 ${
                highlightedTxs.has(tx.hash)
                  ? 'animate-slideIn border-blue-500/50 bg-blue-500/5'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <a
                  href={`/${chainName}/transactions/${tx.hash}`}
                  className="text-blue-500 hover:text-blue-400 font-mono text-sm"
                >
                  {tx.hash.slice(0, 16)}...
                </a>
                <div className="flex items-center">
                  {tx.result === 'Success' ? (
                    <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  <span className={`text-sm ${tx.result === 'Success' ? 'text-green-500' : 'text-red-500'}`}>
                    {tx.result}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-400">
                  {t('overview.type')}: <span className="text-white">{getTypeShortName(tx.type)}</span>
                </span>
                <span className="text-gray-400">
                  {t('overview.fee')}: <span className="text-white">{formatFee(tx.fee)}</span>
                </span>
                <span className="text-gray-400 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDistanceToNow(new Date(tx.time), { addSuffix: true })}
                </span>
                <span className="text-gray-400">
                  {t('overview.height')}: <span className="text-white">{tx.height}</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
