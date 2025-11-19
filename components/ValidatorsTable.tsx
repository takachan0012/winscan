'use client';

import { ValidatorData, ChainAsset } from '@/types/chain';
import Link from 'next/link';
import { Users, TrendingUp, Award } from 'lucide-react';
import ValidatorAvatar from '@/components/ValidatorAvatar';
import { memo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';

interface ValidatorsTableProps {
  validators: ValidatorData[];
  chainName: string;
  asset?: ChainAsset;
}

const ValidatorRow = memo(({ validator, chainPath, asset, t, rank, totalVotingPower, cumulativeShare }: { 
  validator: ValidatorData; 
  chainPath: string; 
  asset?: ChainAsset;
  t: (key: string) => string;
  rank: number;
  totalVotingPower: number;
  cumulativeShare: number;
}) => {
  const formatVotingPower = (power: string) => {
    if (!asset) return power;
    const powerNum = parseFloat(power) / Math.pow(10, Number(asset.exponent));
    if (powerNum >= 1e6) return `${(powerNum / 1e6).toFixed(2)}M`;
    if (powerNum >= 1e3) return `${(powerNum / 1e3).toFixed(2)}K`;
    return powerNum.toFixed(2);
  };

  const formatCommission = (commission: string) => {
    return `${(parseFloat(commission) * 100).toFixed(2)}%`;
  };

  const calculateVotingPowerPercentage = (power: string) => {
    const powerNum = parseFloat(power);
    if (totalVotingPower === 0) return '0.00';
    return ((powerNum / totalVotingPower) * 100).toFixed(2);
  };

  return (
    <tr className="border-b border-gray-800 hover:bg-[#1a1a1a] transition-colors duration-150">
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <span className="text-gray-400 font-medium min-w-[30px]">{rank}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center space-x-3">
          <ValidatorAvatar
            identity={validator.identity}
            moniker={validator.moniker}
            size="md"
          />
          <div>
            <Link
              href={`/${chainPath}/validators/${validator.address}`}
              className="text-white hover:text-blue-400 font-medium transition-colors"
            >
              {validator.moniker || t('common.unknown')}
            </Link>
            <div className="text-xs text-gray-500 mt-0.5 font-mono truncate max-w-[200px]">
              {validator.address?.slice(0, 20)}...
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div>
          <div className="text-gray-300 font-medium">
            {formatVotingPower(validator.votingPower || '0')}
            {asset && <span className="text-gray-500 ml-1 text-sm">{asset.symbol}</span>}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {calculateVotingPowerPercentage(validator.votingPower || '0')}%
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="#374151"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="#3b82f6"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - cumulativeShare / 100)}`}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="text-gray-300 font-medium">
            {cumulativeShare.toFixed(2)}%
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-gray-300">
        {formatCommission(validator.commission || '0')}
      </td>
      <td className="px-6 py-4 text-gray-300">
        {validator.delegatorsCount !== undefined && validator.delegatorsCount > 0 ? (
          <div className="font-medium">{validator.delegatorsCount.toLocaleString()}</div>
        ) : (
          <div className="text-gray-500">-</div>
        )}
      </td>
      <td className="px-6 py-4">
        <div className={`font-medium ${
          (validator.uptime || 100) >= 99 ? 'text-green-400' :
          (validator.uptime || 100) >= 95 ? 'text-yellow-400' :
          'text-red-400'
        }`}>
          {(validator.uptime || 100).toFixed(2)}%
        </div>
      </td>
    </tr>
  );
});

ValidatorRow.displayName = 'ValidatorRow';

export default function ValidatorsTable({ validators, chainName, asset }: ValidatorsTableProps) {
  const chainPath = chainName.toLowerCase().replace(/\s+/g, '-');
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  
  const totalVotingPower = validators.reduce((sum, v) => sum + parseFloat(v.votingPower || '0'), 0);
  const activeCount = validators.length; // Already filtered to active only

  // Calculate cumulative share for each validator
  const validatorsWithCumulative = validators.map((validator, index) => {
    const cumulativeShare = validators
      .slice(0, index + 1)
      .reduce((sum, v) => sum + parseFloat(v.votingPower || '0'), 0);
    return {
      ...validator,
      cumulativeShareValue: (cumulativeShare / totalVotingPower) * 100
    };
  });

  const formatVotingPower = (power: number) => {
    if (!asset) return power.toString();
    const powerNum = power / Math.pow(10, Number(asset.exponent));
    if (powerNum >= 1e6) return `${(powerNum / 1e6).toFixed(2)}M`;
    if (powerNum >= 1e3) return `${(powerNum / 1e3).toFixed(2)}K`;
    return powerNum.toFixed(2);
  };

  return (
    <div className="space-y-6 smooth-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">{t('validators.active')} {t('validators.title')}</p>
              <p className="text-3xl font-bold text-white">{activeCount}</p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Bonded Token</p>
              <p className="text-3xl font-bold text-white">
                {formatVotingPower(totalVotingPower)} {asset?.symbol}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-500" />
          </div>
        </div>

        <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm mb-1">Top Validator</p>
              <p className="text-xl font-bold text-white truncate max-w-[180px]">
                {validators[0]?.moniker || 'N/A'}
              </p>
            </div>
            <Award className="w-10 h-10 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Validators Table */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
        <div 
          className="overflow-x-auto scroll-smooth" 
          style={{ 
            maxHeight: 'calc(100vh - 400px)', 
            minHeight: '500px', 
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: '#374151 #1a1a1a'
          }}
        >
          <table className="w-full">
            <thead className="bg-[#0f0f0f] border-b border-gray-800 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">#</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase">Validator</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-blue-400 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Voting Power</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-blue-400 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Cumulative Share</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-blue-400 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Comm.</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-blue-400 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Delegators</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase cursor-pointer hover:text-blue-400 transition-colors">
                <div className="flex items-center space-x-1">
                  <span>Uptime</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {validatorsWithCumulative.map((validator, index) => (
              <ValidatorRow
                key={validator.address}
                validator={validator}
                chainPath={chainPath}
                asset={asset}
                t={t}
                rank={index + 1}
                totalVotingPower={totalVotingPower}
                cumulativeShare={validator.cumulativeShareValue}
              />
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
