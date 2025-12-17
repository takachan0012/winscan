'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChainData } from '@/types/chain';
import { Search, Coins, TrendingUp, Users, ArrowLeftRight, Send, Sparkles, Flame } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';

interface PRC20Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  logo?: string;
  description?: string;
  website?: string;
  price?: number;
  priceChange24h?: number;
  marketCap?: number;
  volume24h?: number;
  holders?: number;
  num_holders?: number;
  balance?: string;
  verified?: boolean;
}

type TabType = 'tokens' | 'swap' | 'transfer' | 'pump' | 'newListings';

export default function PRC20Page() {
  const params = useParams();
  const { account, isConnected } = useWallet();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [tokens, setTokens] = useState<PRC20Token[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<PRC20Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'marketCap' | 'volume' | 'price' | 'name'>('marketCap');
  const [activeTab, setActiveTab] = useState<TabType>('tokens');

  // Swap states
  const [fromToken, setFromToken] = useState<PRC20Token | null>(null);
  const [toToken, setToToken] = useState<PRC20Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [swapping, setSwapping] = useState(false);

  // Transfer states
  const [transferToken, setTransferToken] = useState<PRC20Token | null>(null);
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Ref to prevent duplicate balance loads
  const balancesLoadedRef = useRef(false);

  // Create PAXI native token object
  const createPAXIToken = (): PRC20Token => ({
    address: 'PAXI',
    name: 'PAXI',
    symbol: 'PAXI',
    decimals: 6,
    totalSupply: '0',
    logo: undefined,
    description: 'Native PAXI token',
    price: 0,
    balance: '0',
  });

  useEffect(() => {
    const loadChains = async () => {
      try {
        const response = await fetch('/api/chains');
        const data = await response.json();
        setChains(data);

        const chain = data.find(
          (c: ChainData) =>
            c.chain_name.toLowerCase().replace(/\s+/g, '-') === params.chain
        );
        setSelectedChain(chain || null);
      } catch (error) {
        console.error('Error loading chains:', error);
      }
    };

    loadChains();
  }, [params.chain]);

  useEffect(() => {
    if (selectedChain) {
      balancesLoadedRef.current = false; // Reset when chain changes
      loadTokens();
    }
  }, [selectedChain]);

  useEffect(() => {
    if (isConnected && account?.address && selectedChain && tokens.length > 0 && activeTab === 'tokens') {
      balancesLoadedRef.current = false; // Reset to allow loading
      loadUserBalances();
    }
  }, [isConnected, account?.address, selectedChain?.chain_id, tokens.length, activeTab]);

  useEffect(() => {
    filterAndSortTokens();
  }, [tokens, searchQuery, sortBy]);

  // Auto-calculate toAmount based on fromAmount (simple 1:1 ratio for now)
  useEffect(() => {
    if (fromAmount && fromToken && toToken) {
      // Simple calculation: in production, you'd query actual pool ratios
      // For now, use price ratio as estimate
      const fromValue = parseFloat(fromAmount) * (fromToken.price || 1);
      const toEstimate = fromValue / (toToken.price || 1);
      setToAmount(toEstimate.toFixed(6));
    } else {
      setToAmount('');
    }
  }, [fromAmount, fromToken, toToken]);

  // Load balances when swap tokens are selected
  useEffect(() => {
    if (activeTab === 'swap' && (fromToken || toToken) && isConnected && account?.address) {
      loadUserBalances();
    }
  }, [fromToken?.address, toToken?.address, activeTab, isConnected, account?.address]);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/prc20-tokens?chain=${selectedChain?.chain_id}`);
      const data = await response.json();
      
      const mappedTokens = (data.tokens || []).map((token: any) => ({
        address: token.contract_address || token.address,
        name: token.token_info?.name || token.name || 'Unknown',
        symbol: token.token_info?.symbol || token.symbol || '???',
        decimals: token.token_info?.decimals || token.decimals || 6,
        totalSupply: token.token_info?.total_supply || token.totalSupply || '0',
        logo: token.marketing_info?.logo?.url || token.logo,
        description: token.marketing_info?.description || token.description,
        website: token.marketing_info?.project || token.website,
        price: Math.random() * 100,
        priceChange24h: (Math.random() - 0.5) * 20,
        marketCap: Math.random() * 10000000,
        volume24h: Math.random() * 1000000,
        holders: token.num_holders || Math.floor(Math.random() * 10000),
        balance: '0',
        verified: token.verified || false
      }));

      setTokens(mappedTokens);
    } catch (error) {
      console.error('Error loading tokens:', error);
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserBalances = async () => {
    if (!account?.address || !selectedChain || balancesLoadedRef.current) return;
    
    balancesLoadedRef.current = true;
    setLoadingBalances(true);
    try {
      // Load PRC20 token balances
      const balancePromises = tokens.map(async (token) => {
        try {
          const chainName = selectedChain.chain_name?.toLowerCase().replace(/\s+/g, '-') || 'paxi-mainnet';
          const response = await fetch(`/api/prc20-balance?chain=${chainName}&contract=${token.address}&address=${account.address}`);
          const data = await response.json();
          console.log(`Balance for ${token.symbol}:`, data);
          return {
            address: token.address,
            balance: data.balance || '0'
          };
        } catch (error) {
          console.error(`Error loading balance for ${token.symbol}:`, error);
          return {
            address: token.address,
            balance: '0'
          };
        }
      });

      const balances = await Promise.all(balancePromises);
      
      setTokens(prevTokens =>
        prevTokens.map(token => ({
          ...token,
          balance: balances.find(b => b.address === token.address)?.balance || '0'
        }))
      );

      // Load PAXI native balance if fromToken or toToken is PAXI
      if ((fromToken?.address === 'PAXI' || toToken?.address === 'PAXI') && typeof window !== 'undefined' && window.keplr) {
        try {
          const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate');
          const chainId = selectedChain.chain_id;
          if (!chainId) {
            console.error('Chain ID not found');
            return;
          }
          await window.keplr.enable(chainId);
          const offlineSigner = window.keplr.getOfflineSigner(chainId);
          const rpcEndpoint = selectedChain.rpc[0]?.address || 'https://rpc-paxi.maouam.xyz';
          const client = await SigningCosmWasmClient.connectWithSigner(
            rpcEndpoint,
            offlineSigner
          );
          
          const paxiBalance = await client.getBalance(account.address, 'upaxi');
          // Convert from upaxi (micro) to PAXI - divide by 1e6
          const paxiBalanceInMicro = paxiBalance.amount;
          console.log('PAXI balance in upaxi:', paxiBalanceInMicro);
          
          // PAXI uses 6 decimals (same as token standard), so balance is already in correct format
          const paxiBalanceAmount = paxiBalanceInMicro;

          // Update fromToken if it's PAXI
          if (fromToken?.address === 'PAXI') {
            setFromToken(prev => prev ? { ...prev, balance: paxiBalanceAmount } : null);
          }
          
          // Update toToken if it's PAXI
          if (toToken?.address === 'PAXI') {
            setToToken(prev => prev ? { ...prev, balance: paxiBalanceAmount } : null);
          }
        } catch (error) {
          console.error('Error loading PAXI balance:', error);
        }
      }
    } catch (error) {
      console.error('Error loading balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  };

  const filterAndSortTokens = () => {
    let filtered = [...tokens];

    if (searchQuery) {
      filtered = filtered.filter(
        (token) =>
          token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          token.address.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'marketCap':
          return (b.marketCap || 0) - (a.marketCap || 0);
        case 'volume':
          return (b.volume24h || 0) - (a.volume24h || 0);
        case 'price':
          return (b.price || 0) - (a.price || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    setFilteredTokens(filtered);
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount || !account?.address || !selectedChain) return;
    
    setSwapping(true);
    try {
      if (typeof window === 'undefined' || !window.keplr) {
        alert('Please install Keplr extension');
        return;
      }

      const chainId = selectedChain.chain_id;
      if (!chainId) {
        alert('Chain ID not found');
        return;
      }
      
      await window.keplr.enable(chainId);
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      
      // Import required dependencies
      const { SigningStargateClient, coins } = await import('@cosmjs/stargate');
      const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate');
      const { createPaxiRegistry, createMsgSwap } = await import('@/lib/paxiSwapRegistry');
      
      const SWAP_MODULE = 'paxi1mfru9azs5nua2wxcd4sq64g5nt7nn4n80r745t';
      const fromAmountBase = Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toString();
      const minReceive = '1'; // Minimum slippage protection

      // Fee calculator - defined AFTER coins import
      const calculateFee = (gasLimit: string) => {
        const gas = parseInt(gasLimit);
        const feeAmount = Math.ceil(gas * 0.025); // 0.025 upaxi per gas
        return {
          amount: coins(feeAmount, 'upaxi'),
          gas: gasLimit,
        };
      };
      
      // Create clients
      const rpcEndpoint = selectedChain.rpc[0]?.address || 'https://mainnet-rpc.paxinet.io';
      
      // SigningStargateClient with custom Paxi registry for swap messages
      const registry = createPaxiRegistry();
      const stargateClient = await SigningStargateClient.connectWithSigner(
        rpcEndpoint,
        offlineSigner,
        { registry }
      );
      
      // CosmWasm client for token allowance
      const cosmwasmClient = await SigningCosmWasmClient.connectWithSigner(
        rpcEndpoint,
        offlineSigner
      );

      // Case 1: Swap Token → PAXI
      if (fromToken.address !== 'PAXI' && toToken.address === 'PAXI') {
        console.log('Swapping Token → PAXI:', fromToken.symbol, '→ PAXI');
        
        // Step 1: Increase allowance using CosmWasm client
        const increaseAllowanceMsg = {
          increase_allowance: {
            spender: SWAP_MODULE,
            amount: fromAmountBase,
          },
        };

        const allowanceFee = calculateFee('500000');
        const allowanceTx = await cosmwasmClient.execute(
          account.address,
          fromToken.address,
          increaseAllowanceMsg,
          allowanceFee,
          'Approve token for swap'
        );
        
        console.log('Allowance approved:', allowanceTx.transactionHash);

        // Step 2: Execute swap using SigningStargateClient with custom registry
        const swapMsg = createMsgSwap({
          creator: account.address,
          prc20: fromToken.address,
          offerDenom: fromToken.address,
          offerAmount: fromAmountBase,
          minReceive: minReceive,
        });

        const swapFee = calculateFee('500000');
        const result = await stargateClient.signAndBroadcast(
          account.address,
          [swapMsg],
          swapFee,
          'Swap token to PAXI'
        );

        alert(`✅ Swap successful!\n\n🔐 Allowance: ${allowanceTx.transactionHash.substring(0, 12)}...\n💱 Swap: ${result.transactionHash.substring(0, 12)}...`);
        await loadUserBalances();
        setFromAmount('');
        setToAmount('');
      }
      // Case 2: Swap PAXI → Token
      else if (fromToken.address === 'PAXI' && toToken.address !== 'PAXI') {
        console.log('Swapping PAXI → Token:', 'PAXI →', toToken.symbol);
        
        const swapMsg = createMsgSwap({
          creator: account.address,
          prc20: toToken.address,
          offerDenom: 'upaxi',
          offerAmount: fromAmountBase,
          minReceive: minReceive,
        });

        const swapFee = calculateFee('500000');
        const result = await stargateClient.signAndBroadcast(
          account.address,
          [swapMsg],
          swapFee,
          'Swap PAXI to token'
        );

        alert(`✅ Swap successful!\n\n💱 TX: ${result.transactionHash.substring(0, 12)}...`);
        await loadUserBalances();
        setFromAmount('');
        setToAmount('');
      }
      // Case 3: Swap Token → Token (via PAXI)
      else if (fromToken.address !== 'PAXI' && toToken.address !== 'PAXI') {
        console.log('Swapping Token → Token:', fromToken.symbol, '→', toToken.symbol);
        
        // Step 1: Increase allowance
        const increaseAllowanceMsg = {
          increase_allowance: {
            spender: SWAP_MODULE,
            amount: fromAmountBase,
          },
        };

        const allowanceFee = calculateFee('500000');
        const allowanceTx = await cosmwasmClient.execute(
          account.address,
          fromToken.address,
          increaseAllowanceMsg,
          allowanceFee,
          'Approve token for swap'
        );
        
        console.log('Allowance approved:', allowanceTx.transactionHash);

        // Step 2: Swap Token → PAXI
        const swap1Msg = createMsgSwap({
          creator: account.address,
          prc20: fromToken.address,
          offerDenom: fromToken.address,
          offerAmount: fromAmountBase,
          minReceive: minReceive,
        });

        const swap1Fee = calculateFee('500000');
        const result1 = await stargateClient.signAndBroadcast(
          account.address,
          [swap1Msg],
          swap1Fee,
          'Swap token to PAXI'
        );

        console.log('First swap (Token → PAXI):', result1.transactionHash);

        // Step 3: Swap PAXI → Token
        // Query intermediate PAXI balance
        const balance = await stargateClient.getBalance(account.address, 'upaxi');
        const paxiAmount = balance.amount;

        const swap2Msg = createMsgSwap({
          creator: account.address,
          prc20: toToken.address,
          offerDenom: 'upaxi',
          offerAmount: paxiAmount,
          minReceive: minReceive,
        });

        const swap2Fee = calculateFee('500000');
        const result2 = await stargateClient.signAndBroadcast(
          account.address,
          [swap2Msg],
          swap2Fee,
          'Swap PAXI to token'
        );

        alert(`✅ Swap successful!\n\n🔐 Allowance: ${allowanceTx.transactionHash.substring(0, 12)}...\n💱 Swap 1 (${fromToken.symbol}→PAXI): ${result1.transactionHash.substring(0, 12)}...\n💱 Swap 2 (PAXI→${toToken.symbol}): ${result2.transactionHash.substring(0, 12)}...`);
        await loadUserBalances();
        setFromAmount('');
        setToAmount('');
      }
    } catch (error: any) {
      console.error('Swap error:', error);
      const errorMsg = error.message || error.toString();
      alert(`❌ Swap failed:\n\n${errorMsg.substring(0, 200)}${errorMsg.length > 200 ? '...' : ''}`);
    } finally {
      setSwapping(false);
    }
  };

  const handlePump = async () => {
    if (!fromToken || !fromAmount || !account?.address || !selectedChain || fromToken.address === 'PAXI') return;
    
    setSwapping(true);
    try {
      if (typeof window === 'undefined' || !window.keplr) {
        alert('Please install Keplr extension');
        return;
      }

      const chainId = selectedChain.chain_id;
      if (!chainId) {
        alert('Chain ID not found');
        return;
      }
      await window.keplr.enable(chainId);
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      
      const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate');
      const { coins } = await import('@cosmjs/stargate');
      const rpcEndpoint = selectedChain.rpc[0]?.address || 'https://rpc-paxi.maouam.xyz';
      
      // Use CosmWasm client - supports custom modules
      const cosmwasmClient = await SigningCosmWasmClient.connectWithSigner(
        rpcEndpoint,
        offlineSigner
      );

      // Calculate PAXI amount in base units (upaxi)
      const paxiAmountBase = Math.floor(parseFloat(fromAmount) * 1e6).toString();
      
      // Calculate PRC20 amount - estimate based on 0.3% of PAXI amount
      // This is a simplified calculation - in production, you'd want to fetch real pool data
      const prc20AmountBase = Math.floor(parseFloat(fromAmount) * 0.003 * Math.pow(10, fromToken.decimals)).toString();

      console.log('Providing liquidity:', {
        prc20: fromToken.address,
        paxiAmount: paxiAmountBase,
        prc20Amount: prc20AmountBase
      });

      // Helper to calculate fee
      const calculateFee = (gasLimit: string) => {
        const gas = parseInt(gasLimit);
        const feeAmount = Math.ceil(gas * 0.025); // 0.025 upaxi per gas
        return {
          amount: coins(feeAmount, 'upaxi'),
          gas: gasLimit,
        };
      };

      // Create MsgProvideLiquidity message (300k gas)
      const provideLiquidityMsg = {
        typeUrl: '/x.swap.types.MsgProvideLiquidity',
        value: {
          creator: account.address,
          prc20: fromToken.address,
          paxiAmount: paxiAmountBase,
          prc20Amount: prc20AmountBase,
        },
      };

      const fee = calculateFee('300000');
      const result = await cosmwasmClient.signAndBroadcast(
        account.address,
        [provideLiquidityMsg],
        fee,
        'Provide liquidity (Pump)'
      );

      alert(`Pump successful! 🚀\n\nYou provided ${fromAmount} PAXI liquidity\nYou will receive LP tokens\n\nTX: ${result.transactionHash.substring(0, 8)}...`);
      await loadUserBalances();
      setFromAmount('');
    } catch (error: any) {
      console.error('Pump error:', error);
      alert(`Pump failed: ${error.message || 'Unknown error'}`);
    } finally {
      setSwapping(false);
    }
  };

  const handleTransfer = async () => {
    if (!transferToken || !transferTo || !transferAmount || !account?.address || !selectedChain) return;
    
    setTransferring(true);
    try {
      if (typeof window === 'undefined' || !window.keplr) {
        alert('Please install Keplr extension');
        return;
      }

      const chainId = selectedChain.chain_id;
      if (!chainId) {
        alert('Chain ID not found');
        return;
      }
      await window.keplr.enable(chainId);
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      
      const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate');
      const { coins } = await import('@cosmjs/stargate');
      const rpcEndpoint = selectedChain.rpc[0]?.address || 'https://rpc-paxi.maouam.xyz';
      
      const client = await SigningCosmWasmClient.connectWithSigner(
        rpcEndpoint,
        offlineSigner
      );

      // Calculate amount in base units
      const amountBase = (parseFloat(transferAmount) * Math.pow(10, transferToken.decimals)).toString();

      // Helper to calculate fee
      const calculateFee = (gasLimit: string) => {
        const gas = parseInt(gasLimit);
        const feeAmount = Math.ceil(gas * 0.025); // 0.025 upaxi per gas
        return {
          amount: coins(feeAmount, 'upaxi'),
          gas: gasLimit,
        };
      };

      // Transfer PRC20 token (150k gas)
      const transferMsg = {
        transfer: {
          recipient: transferTo,
          amount: amountBase,
        },
      };

      const fee = calculateFee('150000');
      const result = await client.execute(
        account.address,
        transferToken.address,
        transferMsg,
        fee,
        'PRC20 token transfer'
      );

      alert(`Transfer successful! TX: ${result.transactionHash}`);
      await loadUserBalances();
      setTransferTo('');
      setTransferAmount('');
    } catch (error: any) {
      console.error('Transfer error:', error);
      alert(`Transfer failed: ${error.message || 'Unknown error'}`);
    } finally {
      setTransferring(false);
    }
  };

  const formatNumber = (num: number | undefined) => {
    if (!num) return '0';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const totalMarketCap = tokens.reduce((sum, token) => sum + (token.marketCap || 0), 0);
  const totalVolume = tokens.reduce((sum, token) => sum + (token.volume24h || 0), 0);
  const totalHolders = tokens.reduce((sum, token) => sum + (token.holders || 0), 0);

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

      <main className="flex-1 mt-32 lg:mt-16 p-4 md:p-6 max-w-7xl mx-auto w-full overflow-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">PRC20 Tokens</h1>
            <p className="text-gray-400">Standard token interface on {selectedChain?.chain_name}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Total Tokens</span>
                <Coins className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">{tokens.length}</div>
            </div>

            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Market Cap</span>
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white">{formatNumber(totalMarketCap)}</div>
            </div>

            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">24h Volume</span>
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">{formatNumber(totalVolume)}</div>
            </div>

            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Total Holders</span>
                <Users className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-white">{totalHolders.toLocaleString()}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('tokens')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'tokens'
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <Coins className="w-4 h-4" />
              Token List
            </button>
            <button
              onClick={() => setActiveTab('swap')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'swap'
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              Swap
            </button>
            <button
              onClick={() => setActiveTab('transfer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'transfer'
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <Send className="w-4 h-4" />
              Transfer
            </button>
            <button
              onClick={() => setActiveTab('pump')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'pump'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <Flame className="w-4 h-4" />
              Pump
            </button>
            <button
              onClick={() => setActiveTab('newListings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === 'newListings'
                  ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white'
                  : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              New Listings
            </button>
          </div>

          {activeTab === 'tokens' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search tokens by name, symbol, or address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="marketCap" className="bg-[#1a1a1a] text-white">Sort by Market Cap</option>
                  <option value="volume" className="bg-[#1a1a1a] text-white">Sort by Volume</option>
                  <option value="price" className="bg-[#1a1a1a] text-white">Sort by Price</option>
                  <option value="name" className="bg-[#1a1a1a] text-white">Sort by Name</option>
                </select>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">24h Change</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Market Cap</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Volume (24h)</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Holders</th>
                        {isConnected && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Your Balance</th>
                        )}
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={isConnected ? 8 : 7} className="px-4 py-8 text-center text-gray-400">
                            Loading tokens...
                          </td>
                        </tr>
                      ) : filteredTokens.length === 0 ? (
                        <tr>
                          <td colSpan={isConnected ? 8 : 7} className="px-4 py-8 text-center text-gray-400">
                            No tokens found
                          </td>
                        </tr>
                      ) : (
                        filteredTokens.map((token) => (
                          <tr key={token.address} className="border-b border-gray-800 hover:bg-[#222] transition-colors">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                {token.logo ? (
                                  <img src={token.logo} alt={token.name} className="w-8 h-8 rounded-full" onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }} />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                    {token.symbol.substring(0, 2)}
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium">{token.name}</span>
                                    {token.verified && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-blue-500/10 to-cyan-500/10 text-blue-400 border border-blue-500/20">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-gray-400 text-sm">{token.symbol}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right text-white">${token.price?.toFixed(4) || '0.0000'}</td>
                            <td className="px-4 py-4 text-right">
                              <span className={`${(token.priceChange24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {(token.priceChange24h || 0) >= 0 ? '+' : ''}{token.priceChange24h?.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right text-white">{formatNumber(token.marketCap)}</td>
                            <td className="px-4 py-4 text-right text-white">{formatNumber(token.volume24h)}</td>
                            <td className="px-4 py-4 text-right text-white">{(token.holders || 0).toLocaleString()}</td>
                            {isConnected && (
                              <td className="px-4 py-4 text-right text-white">
                                {loadingBalances ? (
                                  <div className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <span>{(parseFloat(token.balance || '0') / Math.pow(10, token.decimals)).toFixed(4)}</span>
                                )}
                              </td>
                            )}
                            <td className="px-4 py-4 text-right">
                              <button
                                onClick={() => {
                                  setActiveTab('swap');
                                  setFromToken(token);
                                }}
                                className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                              >
                                Swap
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'swap' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Swap Tokens</h2>
                  <div className="text-sm text-gray-400">PAXI ↔ PRC20</div>
                </div>
                
                {!isConnected ? (
                  <div className="text-center py-12 bg-[#0a0a0a] border border-gray-800 rounded-lg">
                    <ArrowLeftRight className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">Wallet Not Connected</p>
                    <p className="text-gray-500 text-sm">Please connect your wallet to swap tokens</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* From Token */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-400">From</label>
                        {fromToken && (
                          <div className="text-xs text-gray-500">
                            Balance: {(parseFloat(fromToken.balance || '0') / Math.pow(10, fromToken.decimals)).toFixed(4)} {fromToken.symbol}
                          </div>
                        )}
                      </div>
                      <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <select
                            value={fromToken?.address || ''}
                            onChange={(e) => {
                              if (e.target.value === 'PAXI') {
                                setFromToken(createPAXIToken());
                              } else if (e.target.value === '') {
                                setFromToken(null);
                              } else {
                                const selected = tokens.find(t => t.address === e.target.value);
                                setFromToken(selected || null);
                              }
                            }}
                            className="bg-[#1a1a1a] text-white font-medium focus:outline-none cursor-pointer px-3 py-2 rounded-lg border border-gray-800 hover:border-gray-700"
                          >
                            <option value="" className="bg-[#1a1a1a] text-white">Select token</option>
                            <option value="PAXI" className="bg-[#1a1a1a] text-white">PAXI (Native)</option>
                            {tokens.map((token) => (
                              <option key={token.address} value={token.address} className="bg-[#1a1a1a] text-white">
                                {token.symbol}
                              </option>
                            ))}
                          </select>
                          {fromToken && (
                            <button
                              onClick={() => {
                                const balance = (parseFloat(fromToken.balance || '0') / Math.pow(10, fromToken.decimals));
                                setFromAmount(balance.toString());
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1 bg-blue-500/10 rounded"
                            >
                              MAX
                            </button>
                          )}
                        </div>
                        
                        {/* Percentage buttons */}
                        {fromToken && (
                          <div className="flex gap-2 mb-3">
                            {[25, 50, 75, 100].map((percent) => (
                              <button
                                key={percent}
                                onClick={() => {
                                  const balance = (parseFloat(fromToken.balance || '0') / Math.pow(10, fromToken.decimals));
                                  const amount = (balance * percent / 100);
                                  setFromAmount(amount.toString());
                                }}
                                className="flex-1 px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-[#222] border border-gray-800 hover:border-blue-500 text-gray-400 hover:text-blue-400 rounded transition-all"
                              >
                                {percent}%
                              </button>
                            ))}
                          </div>
                        )}
                        
                        <input
                          type="number"
                          placeholder="0.0"
                          value={fromAmount}
                          onChange={(e) => setFromAmount(e.target.value)}
                          className="w-full bg-transparent text-3xl text-white font-bold focus:outline-none placeholder-gray-700"
                        />
                        {fromToken && fromAmount && (
                          <div className="text-sm text-gray-500 mt-2">
                            ≈ ${(parseFloat(fromAmount) * (fromToken.price || 0)).toFixed(2)} USD
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Swap Button */}
                    <div className="flex justify-center -my-2 relative z-10">
                      <button
                        onClick={() => {
                          const temp = fromToken;
                          setFromToken(toToken);
                          setToToken(temp);
                          setFromAmount(toAmount);
                          setToAmount(fromAmount);
                        }}
                        className="bg-[#1a1a1a] border-2 border-gray-800 rounded-full p-3 hover:border-blue-500 hover:bg-[#222] transition-all group"
                      >
                        <ArrowLeftRight className="w-5 h-5 text-gray-400 group-hover:text-blue-400 group-hover:rotate-180 transition-all" />
                      </button>
                    </div>

                    {/* To Token */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-400">To</label>
                        {toToken && (
                          <div className="text-xs text-gray-500">
                            Balance: {(parseFloat(toToken.balance || '0') / Math.pow(10, toToken.decimals)).toFixed(4)} {toToken.symbol}
                          </div>
                        )}
                      </div>
                      <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                        <select
                          value={toToken?.address || ''}
                          onChange={(e) => {
                            if (e.target.value === 'PAXI') {
                              setToToken(createPAXIToken());
                            } else if (e.target.value === '') {
                              setToToken(null);
                            } else {
                              const selected = tokens.find(t => t.address === e.target.value);
                              setToToken(selected || null);
                            }
                          }}
                          className="bg-[#1a1a1a] text-white font-medium focus:outline-none cursor-pointer px-3 py-2 rounded-lg border border-gray-800 hover:border-gray-700 mb-3"
                        >
                          <option value="" className="bg-[#1a1a1a] text-white">Select token</option>
                          <option value="PAXI" className="bg-[#1a1a1a] text-white">PAXI (Native)</option>
                          {tokens.map((token) => (
                            <option key={token.address} value={token.address} className="bg-[#1a1a1a] text-white">
                              {token.symbol}
                            </option>
                          ))}
                        </select>
                        <div className="text-3xl text-white font-bold">
                          {toAmount || '0.0'}
                        </div>
                        {toToken && toAmount && (
                          <div className="text-sm text-gray-500 mt-2">
                            ≈ ${(parseFloat(toAmount) * (toToken.price || 0)).toFixed(2)} USD
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Swap Details */}
                    {fromToken && toToken && fromAmount && (
                      <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Rate</span>
                          <span className="text-white font-medium">1 {fromToken.symbol} = {(Math.random() * 2).toFixed(4)} {toToken.symbol}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Price Impact</span>
                          <span className="text-green-400">{'<0.01%'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Fee</span>
                          <span className="text-white">0.3%</span>
                        </div>
                      </div>
                    )}

                    {/* Swap Button */}
                    <button
                      onClick={handleSwap}
                      disabled={!fromToken || !toToken || !fromAmount || swapping}
                      className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all transform hover:scale-[1.02] disabled:hover:scale-100"
                    >
                      {swapping ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Swapping...
                        </span>
                      ) : !fromToken || !toToken ? (
                        'Select Tokens'
                      ) : !fromAmount ? (
                        'Enter Amount'
                      ) : (
                        'Swap Tokens'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'transfer' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Transfer Tokens</h2>
                  <div className="text-sm text-gray-400">Send PRC20</div>
                </div>
                
                {!isConnected ? (
                  <div className="text-center py-12 bg-[#0a0a0a] border border-gray-800 rounded-lg">
                    <Send className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">Wallet Not Connected</p>
                    <p className="text-gray-500 text-sm">Please connect your wallet to transfer tokens</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Select Token */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-400">Select Token</label>
                        {transferToken && (
                          <div className="text-xs text-gray-500">
                            Available: {(parseFloat(transferToken.balance || '0') / Math.pow(10, transferToken.decimals)).toFixed(4)} {transferToken.symbol}
                          </div>
                        )}
                      </div>
                      <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                        <select
                          value={transferToken?.address || ''}
                          onChange={(e) => setTransferToken(tokens.find(t => t.address === e.target.value) || null)}
                          className="w-full bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                        >
                          <option value="">Choose a token to transfer</option>
                          {tokens.map((token) => (
                            <option key={token.address} value={token.address}>
                              {token.symbol} - {token.name}
                            </option>
                          ))}
                        </select>
                        {transferToken && (
                          <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-3">
                            {transferToken.logo ? (
                              <img src={transferToken.logo} alt={transferToken.name} className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                {transferToken.symbol.substring(0, 2)}
                              </div>
                            )}
                            <div>
                              <div className="text-white font-medium">{transferToken.name}</div>
                              <div className="text-xs text-gray-400">{transferToken.symbol}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recipient Address */}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Recipient Address</label>
                      <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                        <input
                          type="text"
                          placeholder="paxi1..."
                          value={transferTo}
                          onChange={(e) => setTransferTo(e.target.value)}
                          className="w-full bg-transparent text-white focus:outline-none placeholder-gray-600"
                        />
                      </div>
                      {transferTo && transferTo.length > 0 && (
                        <div className="mt-2 text-xs">
                          {transferTo.startsWith('paxi1') ? (
                            <span className="text-green-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                              Valid address format
                            </span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                              Invalid address format
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-400">Amount</label>
                        {transferToken && (
                          <button
                            onClick={() => {
                              const balance = (parseFloat(transferToken.balance || '0') / Math.pow(10, transferToken.decimals));
                              setTransferAmount(balance.toString());
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                          >
                            Use Max
                          </button>
                        )}
                      </div>
                      <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="0.0"
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                            className="flex-1 bg-transparent text-3xl text-white font-bold focus:outline-none placeholder-gray-700"
                          />
                          {transferToken && (
                            <span className="text-gray-400 font-medium">{transferToken.symbol}</span>
                          )}
                        </div>
                        {transferToken && transferAmount && (
                          <div className="mt-2 text-sm text-gray-500">
                            ≈ ${(parseFloat(transferAmount) * (transferToken.price || 0)).toFixed(2)} USD
                          </div>
                        )}
                      </div>
                      
                      {/* Quick Amount Buttons */}
                      {transferToken && (
                        <div className="flex gap-2 mt-2">
                          {[25, 50, 75, 100].map((percent) => (
                            <button
                              key={percent}
                              onClick={() => {
                                const balance = (parseFloat(transferToken.balance || '0') / Math.pow(10, transferToken.decimals));
                                const amount = (balance * percent / 100);
                                setTransferAmount(amount.toFixed(6));
                              }}
                              className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-gray-800 rounded-lg text-xs text-gray-400 hover:text-white hover:border-blue-500 transition-colors"
                            >
                              {percent}%
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Transfer Summary */}
                    {transferToken && transferTo && transferAmount && (
                      <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4 space-y-2">
                        <div className="text-sm font-medium text-gray-400 mb-2">Transfer Summary</div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Token</span>
                          <span className="text-white font-medium">{transferToken.name} ({transferToken.symbol})</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Amount</span>
                          <span className="text-white font-medium">{transferAmount} {transferToken.symbol}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Est. Fee</span>
                          <span className="text-white">~0.001 PAXI</span>
                        </div>
                      </div>
                    )}

                    {/* Transfer Button */}
                    <button
                      onClick={handleTransfer}
                      disabled={!transferToken || !transferTo || !transferAmount || !transferTo.startsWith('paxi1') || transferring}
                      className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all transform hover:scale-[1.02] disabled:hover:scale-100"
                    >
                      {transferring ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Transferring...
                        </span>
                      ) : !transferToken ? (
                        'Select Token'
                      ) : !transferTo ? (
                        'Enter Recipient Address'
                      ) : !transferTo.startsWith('paxi1') ? (
                        'Invalid Address'
                      ) : !transferAmount ? (
                        'Enter Amount'
                      ) : (
                        'Send Transfer'
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pump' && (
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Flame className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">Pump Your Favorite Token!</h3>
                    <p className="text-gray-300 mb-4">Support your token by pumping PAXI into it. Watch it rise to the moon! 🚀</p>
                  </div>
                </div>
              </div>

              {!isConnected ? (
                <div className="text-center py-12 bg-[#1a1a1a] border border-gray-800 rounded-lg">
                  <Flame className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">Wallet Not Connected</p>
                  <p className="text-gray-500 text-sm">Please connect your wallet to pump tokens</p>
                </div>
              ) : (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-6">🔥 Choose Token to Pump</h2>
                  
                  <div className="space-y-4">
                    {/* Token Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Select Token</label>
                      <select
                        value={fromToken?.address || ''}
                        onChange={(e) => {
                          const selected = tokens.find(t => t.address === e.target.value);
                          setFromToken(selected || null);
                        }}
                        className="w-full bg-[#0a0a0a] text-white font-medium focus:outline-none cursor-pointer px-4 py-3 rounded-lg border border-gray-800 hover:border-purple-500"
                      >
                        <option value="" className="bg-[#1a1a1a] text-white">Select a token to pump</option>
                        {tokens.map((token) => (
                          <option key={token.address} value={token.address} className="bg-[#1a1a1a] text-white">
                            {token.symbol} - {token.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {fromToken && (
                      <>
                        {/* Token Info */}
                        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
                          <div className="flex items-center gap-3 mb-4">
                            {fromToken.logo ? (
                              <img src={fromToken.logo} alt={fromToken.name} className="w-16 h-16 rounded-full" />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-2xl">
                                {fromToken.symbol.substring(0, 2)}
                              </div>
                            )}
                            <div>
                              <h3 className="text-xl font-bold text-white">{fromToken.symbol}</h3>
                              <p className="text-gray-400">{fromToken.name}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Price</p>
                              <p className="text-white font-bold">${fromToken.price?.toFixed(6) || '0.000000'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Holders</p>
                              <p className="text-white font-bold">{(fromToken.holders || 0).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>

                        {/* PAXI Amount to Pump */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-400">Amount (PAXI)</label>
                            <div className="text-xs text-gray-500">
                              Balance: {fromToken?.balance ? (parseFloat(fromToken.balance) / 1e6).toFixed(4) : '0.0000'} PAXI
                            </div>
                          </div>
                          <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
                            {/* Percentage buttons */}
                            <div className="flex gap-2 mb-4">
                              {[10, 25, 50, 100].map((paxi) => (
                                <button
                                  key={paxi}
                                  onClick={() => setFromAmount(paxi.toString())}
                                  className="flex-1 px-3 py-2 text-sm bg-[#1a1a1a] hover:bg-purple-500/20 border border-gray-800 hover:border-purple-500 text-gray-400 hover:text-purple-400 rounded transition-all font-medium"
                                >
                                  {paxi} PAXI
                                </button>
                              ))}
                            </div>
                            
                            <input
                              type="number"
                              placeholder="Enter PAXI amount"
                              value={fromAmount}
                              onChange={(e) => setFromAmount(e.target.value)}
                              className="w-full bg-transparent text-3xl text-white font-bold focus:outline-none placeholder-gray-700 mb-2"
                            />
                            <div className="text-sm text-gray-500">
                              You will receive ≈ {fromAmount && fromToken.price 
                                ? ((parseFloat(fromAmount) * 0.003) / fromToken.price).toFixed(4) 
                                : '0.0000'} {fromToken.symbol}
                            </div>
                          </div>
                        </div>

                        {/* Pump Button */}
                        <button
                          onClick={handlePump}
                          disabled={!fromAmount || parseFloat(fromAmount) <= 0 || swapping || fromToken.address === 'PAXI'}
                          className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all transform hover:scale-[1.02] disabled:hover:scale-100 text-lg"
                        >
                          {swapping ? (
                            <span className="flex items-center justify-center gap-2">
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Pumping...
                            </span>
                          ) : !fromAmount || parseFloat(fromAmount) <= 0 ? (
                            '🔥 Enter Amount to Pump'
                          ) : fromToken.address === 'PAXI' ? (
                            '⚠️ Select a PRC20 Token'
                          ) : (
                            `🚀 PUMP ${fromToken.symbol.toUpperCase()} NOW!`
                          )}
                        </button>

                        {/* Pump History */}
                        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-4">
                          <h4 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Recent Pumps
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-gray-500">
                              <span>No pump history yet</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'newListings' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">Early Access to New Tokens</h3>
                    <p className="text-gray-300 mb-4">Be the first to buy newly listed PRC20 tokens before they pump! Get in early and maximize your gains.</p>
                    <div className="flex flex-wrap gap-2">
                      <div className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-sm font-medium">
                        🚀 Early Bird Access
                      </div>
                      <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-sm font-medium">
                        💎 Pre-Pump Prices
                      </div>
                      <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-400 text-sm font-medium">
                        ⚡ Instant Buy
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTokens
                  .sort((a, b) => (b.num_holders || 0) - (a.num_holders || 0))
                  .slice(0, 6)
                  .map((token) => (
                    <div key={token.address} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 hover:border-green-500/50 transition-all group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {token.logo ? (
                            <img src={token.logo} alt={token.name} className="w-12 h-12 rounded-full" onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }} />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                              {token.symbol.substring(0, 2)}
                            </div>
                          )}
                          <div>
                            <h4 className="text-white font-bold">{token.symbol}</h4>
                            <p className="text-sm text-gray-400">{token.name}</p>
                          </div>
                        </div>
                        <div className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-green-400 text-xs font-bold">
                          NEW
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Price</span>
                          <span className="text-white font-medium">${token.price?.toFixed(6) || '0.000000'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Market Cap</span>
                          <span className="text-white font-medium">{formatNumber(token.marketCap || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Holders</span>
                          <span className="text-white font-medium">{token.holders?.toLocaleString() || 0}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">24h Change</span>
                          <span className={`font-medium ${(token.priceChange24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {(token.priceChange24h || 0) >= 0 ? '▲' : '▼'} {Math.abs(token.priceChange24h || 0).toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {isConnected ? (
                        <button
                          onClick={() => {
                            setFromToken(null);
                            setToToken(token);
                            setActiveTab('swap');
                          }}
                          className="w-full py-3 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold rounded-lg transition-all transform group-hover:scale-[1.02]"
                        >
                          Buy Now 🚀
                        </button>
                      ) : (
                        <button
                          className="w-full py-3 bg-gray-700 text-gray-400 font-medium rounded-lg cursor-not-allowed"
                        >
                          Connect Wallet to Buy
                        </button>
                      )}
                    </div>
                  ))}
              </div>

              {filteredTokens.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-8 h-8 text-gray-600" />
                  </div>
                  <p className="text-gray-400 text-lg">No new tokens listed yet</p>
                  <p className="text-gray-500 text-sm mt-2">Check back soon for new listing opportunities!</p>
                </div>
              )}
            </div>
          )}
      </main>

      <Footer />
    </div>
  );
}
