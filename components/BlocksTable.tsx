'use client';
import { BlockData } from '@/types/chain';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Box } from 'lucide-react';
import ValidatorAvatar from '@/components/ValidatorAvatar';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
interface BlocksTableProps {
  blocks: BlockData[];
  chainName: string;
  currentPage: number;
  onPageChange: (page: number) => void;
}
export default function BlocksTable({ blocks, chainName, currentPage, onPageChange }: BlocksTableProps) {
  const chainPath = chainName.toLowerCase().replace(/\s+/g, '-');
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [animatedBlocks, setAnimatedBlocks] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (blocks.length > 0) {
      const newBlocks = blocks.slice(0, 3).map(b => b.height);
      const newSet = new Set(newBlocks);
      setAnimatedBlocks(newSet);
      const timeout = setTimeout(() => {
        setAnimatedBlocks(new Set());
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [blocks]);
  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
      {}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#0f0f0f] border-b border-gray-800">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('blocks.height')}</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('blocks.proposer')}</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t('blocks.hash')}</th>
              <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">{t('blocks.txCount')}</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">{t('blocks.time')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">{blocks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-gray-500 text-lg mb-2">{t('blocks.noBlocks')}</div>
                    <p className="text-gray-600 text-sm">{t('common.loading')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              blocks.map((block) => (
                <tr 
                  key={block.height} 
                  className={`hover:bg-[#222] transition-all duration-500 ${
                    animatedBlocks.has(block.height) 
                      ? 'animate-slideIn bg-blue-500/10 border-l-2 border-blue-500' 
                      : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <Link 
                      href={`/${chainPath}/blocks/${block.height}`}
                      className="flex items-center gap-2 text-blue-400 hover:text-blue-300 font-mono font-medium transition-colors"
                    >
                      <Box className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      {block.height.toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-6 py-4">{block.validator ? (
                      <Link 
                        href={`/${chainPath}/validators/${block.validator.address}`}
                        className="flex items-center gap-2.5 group max-w-xs"
                      >
                        <ValidatorAvatar 
                          identity={block.validator.identity}
                          moniker={block.validator.moniker}
                          size="sm"
                        />
                        <span className="text-white group-hover:text-blue-400 font-normal text-sm transition-colors truncate">
                          {block.validator.moniker}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-gray-500 font-mono text-xs">
                        {block.proposer.slice(0, 12)}...{block.proposer.slice(-8)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-400 font-mono text-xs">
                      {block.hash.slice(0, 20)}...{block.hash.slice(-12)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded text-xs font-medium ${
                      block.txs > 0 ? 'text-green-400' : 'text-gray-500'
                    }`}>
                      {block.txs}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-400 text-sm">
                      {formatDistanceToNow(new Date(block.time), { addSuffix: true })}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {}
      {blocks.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 bg-[#0f0f0f] border-t border-gray-800">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-[#222] hover:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('blocks.previous')}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">{t('blocks.page')}</span>
            <span className="px-3 py-1 bg-[#1a1a1a] border border-gray-700 rounded text-white text-sm font-medium">
              {currentPage}
            </span>
          </div>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-[#222] hover:border-gray-600 transition-all"
          >
            {t('blocks.next')}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
