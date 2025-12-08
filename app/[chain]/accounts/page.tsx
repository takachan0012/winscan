'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Link from 'next/link';
import { ChainData, TransactionData } from '@/types/chain';
import { Users, Search, Wallet, TrendingUp, ArrowUpRight, ArrowDownLeft, DollarSign, Copy, CheckCircle, Send, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { getSavedKeplrAccount, executeSend, executeWithdrawAll, executeWithdrawAllValidators } from '@/lib/keplr';
import { formatDistanceToNow } from 'date-fns';
import ValidatorAvatar from '@/components/ValidatorAvatar';

interface Account {
  address: string;
  balance: {
    denom: string;
    amount: string;
  }[];
}

interface Balance {
  denom: string;
  amount: string;
}

interface Delegation {
  validator: string;
  amount: string;
  validatorInfo?: {
    moniker: string;
    identity?: string;
    operatorAddress: string;
  };
  rewards?: string;
}

interface Reward {
  validator: string;
  amount: string;
}

interface WalletData {
  address: string;
  isValidator?: boolean;
  balances: Balance[];
  delegations: Delegation[];
  rewards: Reward[];
  transactions: TransactionData[];
  commission?: {
    total: string;
    breakdown: any[];
  } | null;
}

export default function AccountsPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendPercentage, setSendPercentage] = useState(0);
  const [sendGasLimit, setSendGasLimit] = useState('200000');
  const [sendMemo, setSendMemo] = useState('Integrate WinScan');
  const [sendLoading, setSendLoading] = useState(false);
  const [showSendResult, setShowSendResult] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [showWithdrawResult, setShowWithdrawResult] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);
  const [showUnjailModal, setShowUnjailModal] = useState(false);
  const [unjailValidator, setUnjailValidator] = useState<{ address: string; moniker: string } | null>(null);
  const [unjailLoading, setUnjailLoading] = useState(false);
  const [showUnjailResult, setShowUnjailResult] = useState(false);
  const [unjailResult, setUnjailResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);
  
  // Unbonding delegations state
  const [unbondingDelegations, setUnbondingDelegations] = useState<any[]>([]);
  const [totalUnbonding, setTotalUnbonding] = useState<string>('0');
  const [unbondingTimes, setUnbondingTimes] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetch('/api/chains')
      .then(res => res.json())
      .then(data => {
        setChains(data);
        const chainName = params?.chain as string;
        const chain = chainName 
          ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
          : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
        if (chain) setSelectedChain(chain);
      });
  }, [params]);

  useEffect(() => {
    const checkWallet = () => {
      const saved = getSavedKeplrAccount();
      if (saved && saved.account) {
        setConnectedAddress(saved.account.address);
      } else {
        setConnectedAddress(null);
        setWalletData(null);
      }
    };

    checkWallet();

    const handleStorageChange = () => checkWallet();
    window.addEventListener('storage', handleStorageChange);

    const handleWalletChange = () => checkWallet();
    window.addEventListener('keplr_wallet_changed', handleWalletChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('keplr_wallet_changed', handleWalletChange);
    };
  }, []);

  useEffect(() => {
    if (!connectedAddress || !selectedChain) return;

    setLoading(true);

    const fetchData = async () => {
      try {
        const chainParam = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
        const response = await fetch(`/api/wallet?chain=${chainParam}&address=${connectedAddress}`);
        const data = await response.json();
        console.log('Account data:', data);
        
        const delegationsWithRewards = await Promise.all(
          (data.delegations || []).map(async (del: any) => {
            try {
              const apiEndpoint = selectedChain.api?.[0]?.address;
              if (apiEndpoint) {
                const rewardsRes = await fetch(
                  `${apiEndpoint}/cosmos/distribution/v1beta1/delegators/${connectedAddress}/rewards/${del.validator}`
                );
                if (rewardsRes.ok) {
                  const rewardsData = await rewardsRes.json();
                  const rewardsList = rewardsData.rewards || [];
                  const mainReward = rewardsList.find((r: any) => r.denom === selectedChain.assets?.[0]?.base) || { amount: '0' };
                  return { ...del, rewards: mainReward.amount };
                }
              }
            } catch (e) {
              console.warn('Failed to fetch rewards for validator:', del.validator);
            }
            return { ...del, rewards: '0' };
          })
        );
        
        setWalletData({
          address: connectedAddress,
          balances: data.balances || [],
          delegations: delegationsWithRewards,
          rewards: data.rewards || [],
          transactions: data.transactions || [],
        });
      } catch (err) {
        console.error('Failed to fetch account data:', err);
        setWalletData({
          address: connectedAddress,
          balances: [],
          delegations: [],
          rewards: [],
          transactions: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Fetch unbonding delegations
    if (connectedAddress) {
      fetchUnbondingDelegations(connectedAddress);
    }
  }, [connectedAddress, selectedChain]);

  // Fetch unbonding delegations
  const fetchUnbondingDelegations = async (delegatorAddress: string) => {
    if (!selectedChain?.api || selectedChain.api.length === 0) return;

    const asset = selectedChain.assets?.[0];
    if (!asset) return;

    try {
      for (const endpoint of selectedChain.api) {
        try {
          const unbondingUrl = `${endpoint.address}/cosmos/staking/v1beta1/delegators/${delegatorAddress}/unbonding_delegations`;
          const res = await fetch(unbondingUrl);
          
          if (res.ok) {
            const data = await res.json();
            const unbondingResponses = data.unbonding_responses || [];
            
            setUnbondingDelegations(unbondingResponses);
            
            // Calculate total unbonding
            let total = 0;
            unbondingResponses.forEach((unbonding: any) => {
              if (Array.isArray(unbonding.entries)) {
                unbonding.entries.forEach((entry: any) => {
                  total += parseFloat(entry.balance || '0');
                });
              }
            });
            
            const formatted = (total / Math.pow(10, Number(asset.exponent))).toFixed(2);
            setTotalUnbonding(formatted);
            break;
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      console.error('Error fetching unbonding delegations:', error);
    }
  };

  // Function to calculate time remaining
  const getTimeRemaining = (completionTime: string) => {
    const now = new Date().getTime();
    const completion = new Date(completionTime).getTime();
    const diff = completion - now;

    if (diff <= 0) return 'Completed';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const parts = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    if (seconds > 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);

    return parts.join(' ') || 'Less than a second';
  };

  // Update countdown timers every second
  useEffect(() => {
    if (unbondingDelegations.length === 0) return;

    const updateTimers = () => {
      const newTimes = new Map<string, string>();
      unbondingDelegations.forEach((unbonding, idx) => {
        if (Array.isArray(unbonding.entries)) {
          const earliestEntry = unbonding.entries.reduce((earliest: any, entry: any) => {
            if (!earliest || new Date(entry.completion_time) < new Date(earliest.completion_time)) {
              return entry;
            }
            return earliest;
          }, null);
          
          if (earliestEntry) {
            newTimes.set(`${unbonding.validator_address}-${idx}`, getTimeRemaining(earliestEntry.completion_time));
          }
        }
      });
      setUnbondingTimes(newTimes);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);

    return () => clearInterval(interval);
  }, [unbondingDelegations]);

  const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchAddress.trim()) {
      window.location.href = `/${chainPath}/accounts/${searchAddress.trim()}`;
    }
  };

  const copyAddress = () => {
    if (connectedAddress) {
      navigator.clipboard.writeText(connectedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAmount = (amount: string, exponent: number = 6) => {
    try {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount === 0) return '0';
      const value = numAmount / Math.pow(10, exponent);
      return value.toLocaleString('en-US', { 
        maximumFractionDigits: 6,
        minimumFractionDigits: 0
      });
    } catch (err) {
      console.error('Error formatting amount:', err, amount);
      return '0';
    }
  };

  const getTotalDelegated = () => {
    if (!walletData?.delegations || walletData.delegations.length === 0) return '0';
    try {
      const total = walletData.delegations.reduce((sum, del) => {
        const amount = parseFloat(del.amount || '0');
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);
      const exponent = parseInt(String(selectedChain?.assets?.[0]?.exponent || '6'));
      return formatAmount(total.toString(), exponent);
    } catch (err) {
      console.error('Error calculating total delegated:', err);
      return '0';
    }
  };

  const getTotalRewards = () => {
    if (!walletData?.delegations || walletData.delegations.length === 0) return '0';
    try {
      // Sum up rewards from all delegations
      const total = walletData.delegations.reduce((sum, del) => {
        const rewardAmount = parseFloat(del.rewards || '0');
        return sum + (isNaN(rewardAmount) ? 0 : rewardAmount);
      }, 0);
      const exponent = parseInt(String(selectedChain?.assets?.[0]?.exponent || '6'));
      return formatAmount(total.toString(), exponent);
    } catch (err) {
      console.error('Error calculating total rewards:', err);
      return '0';
    }
  };

  const handleSendPercentageChange = (percentage: number) => {
    setSendPercentage(percentage);
    if (!walletData?.balances[0]) return;
    
    const balance = parseFloat(walletData.balances[0].amount);
    const exponent = parseInt(String(selectedChain?.assets?.[0]?.exponent || '6'));
    const gasReserve = 0.05 * Math.pow(10, exponent); // Reserve 0.05 tokens for gas
    const maxSendable = Math.max(0, balance - gasReserve);
    const amount = Math.floor((maxSendable * percentage) / 100);
    setSendAmount(amount.toString());
  };

  const handleSendAmountChange = (value: string) => {
    setSendAmount(value);
    if (!walletData?.balances[0]) return;
    
    const balance = parseFloat(walletData.balances[0].amount);
    const exponent = parseInt(String(selectedChain?.assets?.[0]?.exponent || '6'));
    const gasReserve = 0.05 * Math.pow(10, exponent);
    const maxSendable = Math.max(0, balance - gasReserve);
    const percentage = maxSendable > 0 ? Math.min(100, (parseFloat(value) / maxSendable) * 100) : 0;
    setSendPercentage(isNaN(percentage) ? 0 : percentage);
  };

  const handleSendSubmit = async () => {
    if (!selectedChain || !connectedAddress || !sendRecipient || !sendAmount) return;

    setSendLoading(true);
    try {
      const denom = selectedChain.assets?.[0]?.base || 'uatom';
      const result = await executeSend(
        selectedChain,
        {
          fromAddress: connectedAddress,
          toAddress: sendRecipient.trim(),
          amount: sendAmount,
          denom,
        },
        sendGasLimit,
        sendMemo
      );

      setSendResult(result);
      setShowSendResult(true);
    } catch (error: any) {
      setSendResult({ success: false, error: error.message });
      setShowSendResult(true);
    } finally {
      setSendLoading(false);
    }
  };

  const closeSendModal = () => {
    setShowSendModal(false);
    setSendRecipient('');
    setSendAmount('');
    setSendPercentage(0);
    setSendGasLimit('200000');
    setSendMemo('Integrate WinScan');
  };

  const closeSendResultModal = () => {
    setShowSendResult(false);
    setSendResult(null);
    closeSendModal();
  };

  const handleUnjailSubmit = async () => {
    if (!selectedChain || !unjailValidator) return;

    setUnjailLoading(true);
    try {
      const { executeUnjail } = await import('@/lib/keplr');
      const result = await executeUnjail(selectedChain, {
        validatorAddress: unjailValidator.address
      });

      setUnjailResult(result);
      setShowUnjailResult(true);
    } catch (error: any) {
      setUnjailResult({ success: false, error: error.message });
      setShowUnjailResult(true);
    } finally {
      setUnjailLoading(false);
    }
  };

  const closeUnjailModal = () => {
    setShowUnjailModal(false);
    setUnjailValidator(null);
  };

  const closeUnjailResultModal = () => {
    setShowUnjailResult(false);
    setUnjailResult(null);
    closeUnjailModal();
  };

  const handleWithdrawRewards = async (validatorAddress: string) => {
    if (!selectedChain || !connectedAddress) return;

    setWithdrawLoading(true);
    try {
      const result = await executeWithdrawAll(
        selectedChain,
        {
          delegatorAddress: connectedAddress,
          validatorAddress: validatorAddress,
          hasRewards: true,
          hasCommission: false,
        },
        '300000',
        'Integrate WinScan'
      );

      setWithdrawResult(result);
      setShowWithdrawResult(true);
    } catch (error: any) {
      setWithdrawResult({ success: false, error: error.message });
      setShowWithdrawResult(true);
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleWithdrawAllRewards = async () => {
    if (!selectedChain || !connectedAddress || !walletData?.delegations || walletData.delegations.length === 0) return;

    setWithdrawLoading(true);
    try {
      // Get all validator addresses that have rewards
      const validatorAddresses = walletData.delegations
        .filter(del => del.rewards && parseFloat(del.rewards) > 0)
        .map(del => del.validator);
      
      if (validatorAddresses.length === 0) {
        setWithdrawResult({ success: false, error: 'No rewards to withdraw' });
        setShowWithdrawResult(true);
        setWithdrawLoading(false);
        return;
      }
      
      console.log('Withdrawing from', validatorAddresses.length, 'validators');
      
      const baseGas = 200000;
      const perValidatorGas = 100000;
      const calculatedGas = baseGas + (validatorAddresses.length * perValidatorGas);
      const gasLimit = calculatedGas.toString();
      
      console.log('Using gas limit:', gasLimit, 'for', validatorAddresses.length, 'validators');
      
      const result = await executeWithdrawAllValidators(
        selectedChain,
        {
          delegatorAddress: connectedAddress,
          validatorAddresses: validatorAddresses,
        },
        gasLimit,
        'Integrate WinScan'
      );

      setWithdrawResult(result);
      setShowWithdrawResult(true);
    } catch (error: any) {
      setWithdrawResult({ success: false, error: error.message });
      setShowWithdrawResult(true);
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-16 p-6 overflow-auto">
          <div className="flex items-center text-sm text-gray-400 mb-6">
            <Link href={`/${chainPath}`} className="hover:text-blue-500">{t('overview.title')}</Link>
            <span className="mx-2">/</span>
            <span className="text-white">{t('accounts.title')}</span>
          </div>

          <h1 className="text-3xl font-bold text-white mb-6">{t('accounts.title')}</h1>

          {/* Connected Wallet Section */}
          {connectedAddress && walletData ? (
            <div className="space-y-6">
              {/* Wallet Address Card */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    My Wallet
                    {walletData.isValidator && (() => {
                      // Get validator info from delegations for status
                      const selfDelegation = walletData.delegations?.find((d: any) => {
                        const validatorAccountAddr = d.validatorInfo?.operatorAddress || d.validator || '';
                        // Simple check: validator address contains own delegation
                        return validatorAccountAddr.toLowerCase().includes('valoper');
                      });
                      const validatorInfo = selfDelegation?.validatorInfo;
                      const isJailed = (validatorInfo as any)?.jailed || false;
                      const status = (validatorInfo as any)?.status || '';
                      const isBonded = status === 'BOND_STATUS_BONDED';
                      const isUnbonding = status === 'BOND_STATUS_UNBONDING';
                      const isUnbonded = status === 'BOND_STATUS_UNBONDED';
                      
                      return (
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          isJailed 
                            ? 'bg-red-500/20 border border-red-500/30 text-red-400' 
                            : isBonded
                            ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                            : isUnbonding
                            ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-400'
                            : isUnbonded
                            ? 'bg-gray-500/20 border border-gray-500/30 text-gray-400'
                            : 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                        }`}>
                          {isJailed ? '🔴 JAILED' : isBonded ? '🟢 ACTIVE' : isUnbonding ? '🟡 UNBONDING' : isUnbonded ? '⚪ UNBONDED' : '🔵 VALIDATOR'}
                        </span>
                      );
                    })()}
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowSendModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-lg transition-colors font-medium"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </button>
                    <button
                      onClick={copyAddress}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-300">Copy Address</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <code className="text-blue-400 font-mono text-sm break-all">
                  {connectedAddress}
                </code>
              </div>

              {/* Balance Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Available Balance */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Available Balance</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {loading ? '...' : walletData.balances[0] 
                      ? formatAmount(walletData.balances[0].amount, parseInt(String(selectedChain?.assets?.[0]?.exponent || '6'))) 
                      : '0'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedChain?.assets?.[0]?.symbol || 'Token'}
                  </p>
                </div>

                {/* Total Delegated */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">Total Delegated</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {loading ? '...' : getTotalDelegated()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {walletData.delegations.length} validator(s)
                  </p>
                </div>

                {/* Pending Rewards */}
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="text-sm">Pending Rewards</span>
                  </div>
                  <p className="text-2xl font-bold text-green-400">
                    {loading ? '...' : getTotalRewards()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedChain?.assets?.[0]?.symbol || 'Token'}
                  </p>
                </div>
              </div>

              {/* My Delegations */}
              {walletData.delegations.length > 0 && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                  <div className="p-6 border-b border-gray-800">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        My Delegations ({walletData.delegations.length})
                      </h2>
                      {parseFloat(getTotalRewards()) > 0 && (
                        <button
                          onClick={handleWithdrawAllRewards}
                          disabled={withdrawLoading}
                          className="px-4 py-2 bg-white text-black hover:bg-gray-100 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                          {withdrawLoading ? 'Processing...' : 'Withdraw All Rewards'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#0f0f0f]">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Validator</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Amount</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Rewards</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {walletData.delegations.map((delegation, idx) => (
                          <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {delegation.validatorInfo && (
                                  <ValidatorAvatar 
                                    identity={delegation.validatorInfo.identity}
                                    moniker={delegation.validatorInfo.moniker}
                                    size="sm"
                                  />
                                )}
                                  <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium">
                                      {delegation.validatorInfo?.moniker || 'Unknown'}
                                    </span>
                                    {delegation.validatorInfo && (() => {
                                      const validatorInfo = delegation.validatorInfo as any;
                                      const isJailed = validatorInfo.jailed || false;
                                      const status = validatorInfo.status || '';
                                      const isBonded = status === 'BOND_STATUS_BONDED';
                                      const isUnbonding = status === 'BOND_STATUS_UNBONDING';
                                      const isUnbonded = status === 'BOND_STATUS_UNBONDED';
                                      
                                      if (isJailed) {
                                        return (
                                          <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold rounded">
                                            JAILED
                                          </span>
                                        );
                                      } else if (isUnbonding) {
                                        return (
                                          <span className="px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-semibold rounded">
                                            UNBONDING
                                          </span>
                                        );
                                      } else if (isUnbonded) {
                                        return (
                                          <span className="px-2 py-0.5 bg-gray-500/20 border border-gray-500/30 text-gray-400 text-xs font-semibold rounded">
                                            UNBONDED
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                  <code className="text-xs text-gray-500">
                                    {delegation.validator?.slice(0, 20) || 'N/A'}...
                                  </code>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-white font-mono">
                                {delegation.amount ? formatAmount(delegation.amount, parseInt(String(selectedChain?.assets?.[0]?.exponent || '6'))) : '0'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {selectedChain?.assets?.[0]?.symbol || 'Token'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-green-400 font-mono text-sm">
                                {delegation.rewards 
                                  ? formatAmount(delegation.rewards, parseInt(String(selectedChain?.assets?.[0]?.exponent || '6')))
                                  : '0'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {selectedChain?.assets?.[0]?.symbol || 'Token'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                {(() => {
                                  const validatorInfo = delegation.validatorInfo as any;
                                  const isJailed = validatorInfo?.jailed || false;
                                  const operatorAddress = validatorInfo?.operatorAddress || delegation.validator || '';
                                  
                                  // Check if connected wallet is the validator operator
                                  const { convertValidatorToAccountAddress } = require('@/lib/addressConverter');
                                  const validatorAccountAddress = operatorAddress ? convertValidatorToAccountAddress(operatorAddress) : '';
                                  const isOwnValidator = connectedAddress && validatorAccountAddress && 
                                    connectedAddress.toLowerCase() === validatorAccountAddress.toLowerCase();
                                  
                                  // Show Unjail button if jailed AND own validator
                                  if (isJailed && isOwnValidator) {
                                    return (
                                      <button
                                        onClick={() => {
                                          setUnjailValidator({
                                            address: operatorAddress,
                                            moniker: validatorInfo?.moniker || 'Validator'
                                          });
                                          setShowUnjailModal(true);
                                        }}
                                        className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-red-500/30 hover:shadow-xl hover:scale-105 active:scale-95"
                                      >
                                        Unjail
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}
                                <Link
                                  href={`/${chainPath}/validators/${delegation.validatorInfo?.operatorAddress || delegation.validator}`}
                                  className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white text-sm font-medium rounded-lg transition-all hover:scale-105 active:scale-95 inline-flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View
                                </Link>
                                <button
                                  onClick={() => handleWithdrawRewards(delegation.validator)}
                                  disabled={withdrawLoading || !delegation.rewards || parseFloat(delegation.rewards) === 0}
                                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/30 disabled:shadow-none hover:scale-105 active:scale-95 disabled:scale-100 inline-flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {withdrawLoading ? 'Processing...' : 'Withdraw'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Unbonding Delegations */}
              {unbondingDelegations.length > 0 && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4">
                    Unbonding Delegations ({unbondingDelegations.length})
                  </h2>
                  <div className="space-y-3">
                    {unbondingDelegations.map((unbonding: any, idx) => {
                      const validatorAddr = unbonding.validator_address || '';
                      const asset = selectedChain?.assets?.[0];
                      
                      return (
                        <div key={idx} className="bg-[#0f0f0f] border border-orange-800/30 rounded-lg p-4">
                          <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="flex-1">
                              <p className="text-gray-400 text-sm mb-1">Validator</p>
                              <Link 
                                href={`/${chainPath}/validators/${validatorAddr}`}
                                className="text-white hover:text-orange-400 font-medium transition-colors"
                              >
                                {validatorAddr.slice(0, 20)}...{validatorAddr.slice(-10)}
                              </Link>
                            </div>
                          </div>
                          
                          {Array.isArray(unbonding.entries) && unbonding.entries.map((entry: any, entryIdx: number) => {
                            const amount = parseFloat(entry.balance || '0');
                            const formatted = (amount / Math.pow(10, Number(asset?.exponent || 6))).toFixed(2);
                            
                            return (
                              <div key={entryIdx} className="flex items-center justify-between p-3 bg-[#111111] rounded-lg mb-2 last:mb-0">
                                <div className="flex-1">
                                  <p className="text-orange-500 font-semibold text-lg">
                                    {formatted} {asset?.symbol}
                                  </p>
                                  {entry.completion_time && (
                                    <p className="text-gray-500 text-xs mt-1">
                                      {getTimeRemaining(entry.completion_time)}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-gray-400 text-xs">Completion</p>
                                  <p className="text-gray-300 text-sm">
                                    {new Date(entry.completion_time).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              {walletData.transactions && walletData.transactions.length > 0 ? (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                  <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <ArrowDownLeft className="w-5 h-5" />
                      All Transactions
                      <span className="text-sm font-normal text-gray-400">({walletData.transactions.length} total)</span>
                    </h2>
                    {walletData.transactions.length >= 100 && (
                      <span className="text-xs text-yellow-400">Showing last 100 transactions</span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#0f0f0f]">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tx Hash</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {walletData.transactions.map((tx, idx) => (
                          <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/${chainPath}/transactions/${tx.hash}`}
                                  className="text-blue-400 hover:text-blue-300 font-mono text-sm"
                                >
                                  {tx.hash.slice(0, 16)}...
                                </Link>
                                <button
                                  onClick={(e) => {
                                    navigator.clipboard.writeText(tx.hash);
                                    const btn = e.currentTarget as HTMLElement;
                                    const originalContent = btn.innerHTML;
                                    btn.innerHTML = '<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                                    setTimeout(() => {
                                      btn.innerHTML = originalContent;
                                    }, 1500);
                                  }}
                                  className="text-gray-400 hover:text-gray-300 transition-colors"
                                  title="Copy hash"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-gray-300 text-sm">
                                {tx.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-400 text-sm">
                              {formatDistanceToNow(new Date(tx.time), { addSuffix: true })}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {tx.result?.toLowerCase() === 'success' ? (
                                <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                              ) : (
                                <span className="text-red-400">Failed</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 border-t border-gray-800 text-center">
                    <Link
                      href={`/${chainPath}/accounts/${connectedAddress}`}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      View All Transactions →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-12 text-center">
                  <ArrowDownLeft className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">No Recent Transactions</h3>
                  <p className="text-gray-400 text-sm">
                    Your transactions will appear here after you make your first transaction.
                  </p>
                </div>
              )}

              {/* Empty State for No Delegations */}
              {!loading && walletData.delegations.length === 0 && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-12 text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-white mb-2">No Delegations</h3>
                  <p className="text-gray-400 text-sm">
                    You haven't delegated any tokens yet.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Search Form */}
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Search className="w-5 h-5 text-gray-400" />
                  <h3 className="text-lg font-semibold text-white">Search Any Wallet Address</h3>
                </div>
                <form onSubmit={handleSearch} className="flex gap-4 mb-6">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={searchAddress}
                      onChange={(e) => setSearchAddress(e.target.value)}
                      placeholder={t('accounts.searchPlaceholder')}
                      className="w-full bg-[#0f0f0f] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-text-dim focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!searchAddress.trim()}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    {t('accounts.searchButton')}
                  </button>
                </form>
                
                {/* Connect Wallet Section */}
                <div className="pt-6 border-t border-gray-800 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#0f0f0f] border border-gray-800 mb-4">
                    <Wallet className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
                  <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                    Connect your Keplr wallet to view your assets, delegations, and manage your account
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => {
                        const event = new CustomEvent('trigger_keplr_connect');
                        window.dispatchEvent(event);
                      }}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Wallet className="w-4 h-4" />
                      Connect Keplr Wallet
                    </button>
                  </div>
                  <div className="mt-4">
                    <a 
                      href="https://www.keplr.app/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Don't have Keplr? Download →
                    </a>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-[#0f0f0f] rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Example address:</p>
                  <code className="text-xs text-gray-400 font-mono">
                    {selectedChain?.addr_prefix || 'cosmos'}1abc...xyz
                  </code>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Send Modal */}
        {showSendModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-gray-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="p-6 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] z-10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Send Tokens
                </h2>
                <button
                  onClick={closeSendModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Recipient Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Recipient Address
                  </label>
                  <input
                    type="text"
                    value={sendRecipient}
                    onChange={(e) => setSendRecipient(e.target.value)}
                    placeholder={`${selectedChain?.addr_prefix || 'cosmos'}1...`}
                    className="w-full bg-[#0f0f0f] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Amount
                    </label>
                    <span className="text-xs text-gray-500">
                      Available: {walletData?.balances[0] ? formatAmount(walletData.balances[0].amount, parseInt(String(selectedChain?.assets?.[0]?.exponent || '6'))) : '0'} {selectedChain?.assets?.[0]?.symbol || 'Token'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={sendAmount}
                      onChange={(e) => handleSendAmountChange(e.target.value)}
                      placeholder="0"
                      className="flex-1 bg-[#0f0f0f] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <button
                      onClick={() => handleSendPercentageChange(100)}
                      className="px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg font-medium transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                  
                  {/* Percentage Slider */}
                  <div className="mt-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={sendPercentage}
                      onChange={(e) => handleSendPercentageChange(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>0%</span>
                      <span className="text-blue-400 font-medium">{sendPercentage.toFixed(0)}%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>

                {/* Advanced Options */}
                <details className="bg-[#0f0f0f] rounded-lg">
                  <summary className="cursor-pointer p-4 text-sm font-medium text-gray-300 hover:text-white transition-colors flex items-center gap-2">
                    <span>⚙️</span> Advanced Options
                  </summary>
                  <div className="px-4 pb-4 space-y-4">
                    {/* Gas Limit */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Gas Limit
                      </label>
                      <input
                        type="text"
                        value={sendGasLimit}
                        onChange={(e) => setSendGasLimit(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Memo */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Memo (Optional)
                      </label>
                      <input
                        type="text"
                        value={sendMemo}
                        onChange={(e) => setSendMemo(e.target.value)}
                        className="w-full bg-[#1a1a1a] border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </details>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeSendModal}
                    className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendSubmit}
                    disabled={sendLoading || !sendRecipient || !sendAmount || parseFloat(sendAmount) <= 0}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30 disabled:shadow-none"
                  >
                    {sendLoading ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Send Result Modal */}
        {showSendResult && sendResult && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
              <div className="flex flex-col items-center text-center space-y-6">
                {sendResult.success ? (
                  <>
                    {/* Success Icon */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse"></div>
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/50">
                        <svg className="w-10 h-10 text-white animate-bounce-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Success Message */}
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white">Transaction Successful!</h3>
                      <p className="text-gray-400">Your tokens have been sent successfully</p>
                    </div>
                    
                    {/* Transaction Hash */}
                    <div className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Transaction Hash</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-green-400 font-mono break-all flex-1">
                          {sendResult.txHash}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(sendResult.txHash || '');
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
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 w-full pt-2">
                      <button
                        onClick={() => {
                          window.open(`/${chainPath}/transactions/${sendResult.txHash}`, '_blank');
                        }}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
                      >
                        View in Explorer
                      </button>
                      <button
                        onClick={closeSendResultModal}
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
                      <h3 className="text-2xl font-bold text-white">Transaction Failed</h3>
                      <p className="text-gray-400">An error occurred while processing your transaction</p>
                    </div>
                    
                    {/* Error Details */}
                    <div className="w-full bg-[#0a0a0a] border border-red-900/50 rounded-xl p-4 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Error Details</p>
                      <p className="text-sm text-red-400 break-words">
                        {sendResult.error || 'Unknown error occurred'}
                      </p>
                    </div>
                    
                    {/* Close Button */}
                    <button
                      onClick={closeSendResultModal}
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

        {/* Withdraw Result Modal */}
        {showWithdrawResult && withdrawResult && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
              <div className="flex flex-col items-center text-center space-y-6">
                {withdrawResult.success ? (
                  <>
                    {/* Success Icon */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse"></div>
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/50">
                        <svg className="w-10 h-10 text-white animate-bounce-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Success Message */}
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white">Withdrawal Successful!</h3>
                      <p className="text-gray-400">Your rewards have been withdrawn successfully</p>
                    </div>
                    
                    {/* Transaction Hash */}
                    <div className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Transaction Hash</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-green-400 font-mono break-all flex-1">
                          {withdrawResult.txHash}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(withdrawResult.txHash || '');
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
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 w-full pt-2">
                      <button
                        onClick={() => {
                          window.open(`/${chainPath}/transactions/${withdrawResult.txHash}`, '_blank');
                        }}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
                      >
                        View in Explorer
                      </button>
                      <button
                        onClick={() => {
                          setShowWithdrawResult(false);
                          setWithdrawResult(null);
                        }}
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
                      <h3 className="text-2xl font-bold text-white">Withdrawal Failed</h3>
                      <p className="text-gray-400">An error occurred while processing your withdrawal</p>
                    </div>
                    
                    {/* Error Details */}
                    <div className="w-full bg-[#0a0a0a] border border-red-900/50 rounded-xl p-4 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Error Details</p>
                      <p className="text-sm text-red-400 break-words">
                        {withdrawResult.error || 'Unknown error occurred'}
                      </p>
                    </div>
                    
                    {/* Close Button */}
                    <button
                      onClick={() => {
                        setShowWithdrawResult(false);
                        setWithdrawResult(null);
                      }}
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

        {/* Unjail Modal */}
        {showUnjailModal && unjailValidator && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-gray-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="p-6 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] z-10">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Unjail Validator
                </h2>
                <button
                  onClick={closeUnjailModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Validator Info */}
                <div className="bg-[#0f0f0f] rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500 mb-1">Validator</p>
                      <p className="text-white font-semibold">{unjailValidator.moniker}</p>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-500 mb-1">Operator Address</p>
                    <code className="text-xs text-gray-400 font-mono break-all">{unjailValidator.address}</code>
                  </div>
                </div>

                {/* Warning Message */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="flex gap-3">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1 text-sm">
                      <p className="text-red-400 font-semibold mb-1">Important Information</p>
                      <p className="text-gray-400 text-xs leading-relaxed">
                        This will submit an unjail transaction to restore your validator to active status. 
                        Make sure your validator node is running properly before unjailing, otherwise it may get jailed again.
                      </p>
                    </div>
                  </div>
                </div>

                {/* What Happens */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-300">What happens next:</p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 text-sm text-gray-400">
                      <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Transaction will be broadcast to the network</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm text-gray-400">
                      <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Validator will be restored to active status</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm text-gray-400">
                      <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Validator can start signing blocks again</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeUnjailModal}
                    className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUnjailSubmit}
                    disabled={unjailLoading}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30 disabled:shadow-none"
                  >
                    {unjailLoading ? 'Processing...' : 'Unjail Validator'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Unjail Result Modal */}
        {showUnjailResult && unjailResult && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
            <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
              <div className="flex flex-col items-center text-center space-y-6">
                {unjailResult.success ? (
                  <>
                    {/* Success Icon */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse"></div>
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/50">
                        <svg className="w-10 h-10 text-white animate-bounce-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Success Message */}
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white">Unjail Successful!</h3>
                      <p className="text-gray-400">Your validator has been restored to active status</p>
                    </div>
                    
                    {/* Transaction Hash */}
                    <div className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Transaction Hash</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-green-400 font-mono break-all flex-1">
                          {unjailResult.txHash}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(unjailResult.txHash || '');
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
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 w-full pt-2">
                      <button
                        onClick={() => {
                          window.open(`/${chainPath}/transactions/${unjailResult.txHash}`, '_blank');
                        }}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
                      >
                        View in Explorer
                      </button>
                      <button
                        onClick={closeUnjailResultModal}
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
                      <h3 className="text-2xl font-bold text-white">Unjail Failed</h3>
                      <p className="text-gray-400">An error occurred while processing your unjail transaction</p>
                    </div>
                    
                    {/* Error Details */}
                    <div className="w-full bg-[#0a0a0a] border border-red-900/50 rounded-xl p-4 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Error Details</p>
                      <p className="text-sm text-red-400 break-words">
                        {unjailResult.error || 'Unknown error occurred'}
                      </p>
                    </div>
                    
                    {/* Close Button */}
                    <button
                      onClick={closeUnjailResultModal}
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
    </div>
  );
}

