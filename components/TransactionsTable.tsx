'use client';
import { TransactionData, ChainAsset } from '@/types/chain';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Activity, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { useState } from 'react';
interface TransactionsTableProps {
  transactions: TransactionData[];
  chainName: string;
  asset?: ChainAsset;
  currentPage: number;
  onPageChange: (page: number) => void;
}
export default function TransactionsTable({ 
  transactions, 
  chainName, 
  asset,
  currentPage, 
  onPageChange 
}: TransactionsTableProps) {
  const chainPath = chainName.toLowerCase().replace(/\s+/g, '-');
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };
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
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
      {}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#0f0f0f] border-b border-gray-800">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">{t('transactions.hash')}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">{t('transactions.type')}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">{t('transactions.result')}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">{t('transactions.height')}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">{t('transactions.fee')}</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-400">{t('transactions.time')}</th>
            </tr>
          </thead>
          <tbody>
            {safeTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {t('transactions.noTransactions')}
                </td>
              </tr>
            ) : (
              safeTransactions.map((tx) => (
                <tr 
                  key={tx.hash} 
                  className="border-b border-gray-800 hover:bg-[#0f0f0f] transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <Link 
                        href={`/${chainPath}/transactions/${tx.hash}`}
                        className="text-blue-500 hover:text-blue-400 font-mono text-sm"
                      >
                        {tx.hash.slice(0, 8)}...{tx.hash.slice(-8)}
                      </Link>
                      <button
                        onClick={() => copyToClipboard(tx.hash)}
                        className="text-gray-400 hover:text-blue-400 transition-colors"
                        title="Copy hash"
                      >
                        {copiedHash === tx.hash ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">
                      {getTypeShortName(tx.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {tx.result === 'Success' ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                          <span className="text-green-500 text-sm font-medium">Success</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-500 mr-2" />
                          <span className="text-red-500 text-sm font-medium">Failed</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Link 
                      href={`/${chainPath}/blocks/${tx.height}`}
                      className="text-blue-500 hover:text-blue-400 font-mono text-sm"
                    >
                      {tx.height}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-300 text-sm">
                      {formatFee(tx.fee)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-400 text-sm">
                      {formatDistanceToNow(new Date(tx.time), { addSuffix: true })}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {}
      {transactions.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t('transactions.previous')}
          </button>
          <span className="text-gray-400 text-sm">
            {t('transactions.page')} {currentPage}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            className="flex items-center px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            {t('transactions.next')}
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}
    </div>
  );
}
