'use client';
import { BlockData } from '@/types/chain';
import { formatDistanceToNow } from 'date-fns';
import { Box, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import ValidatorAvatar from './ValidatorAvatar';
interface LatestBlocksProps {
  blocks: BlockData[];
  chainName: string;
}
export default function LatestBlocks({ blocks, chainName }: LatestBlocksProps) {
  const [highlightedBlocks, setHighlightedBlocks] = useState<Set<number>>(new Set());
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  
  useEffect(() => {
    if (safeBlocks.length > 0) {
      const newBlocks = safeBlocks.slice(0, 2).map(b => b.height);
      setHighlightedBlocks(new Set(newBlocks));
      const timeout = setTimeout(() => {
        setHighlightedBlocks(new Set());
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [safeBlocks]);
  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          <Box className="w-5 h-5 mr-2" />
          {t('overview.latestBlocks')}
        </h3>
        <a href={`/${chainName}/blocks`} className="text-blue-500 hover:text-blue-400 text-sm">
          {t('overview.viewAllBlocks')} →
        </a>
      </div>
      <div className="space-y-3">
        {safeBlocks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{t('common.loading')}</div>
        ) : (
          safeBlocks.map((block) => (
            <div
              key={block.height}
              className={`bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 hover:border-blue-500 transition-all duration-500 ${
                highlightedBlocks.has(block.height)
                  ? 'animate-slideIn border-blue-500/50 bg-blue-500/5'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <a
                  href={`/${chainName}/blocks/${block.height}`}
                  className="text-blue-500 hover:text-blue-400 font-mono font-bold"
                >
                  #{block.height}
                </a>
                <span className="text-gray-400 text-sm flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDistanceToNow(new Date(block.time), { addSuffix: true })}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {block.validator?.moniker && (
                    <>
                      <ValidatorAvatar 
                        identity={block.validator.identity}
                        moniker={block.validator.moniker}
                        size="sm"
                      />
                      <span className="text-gray-300 text-xs">{block.validator.moniker}</span>
                    </>
                  )}
                </div>
                <span className="text-gray-400">
                  {t('overview.transactions')}: <span className="text-white">{block.txs}</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
