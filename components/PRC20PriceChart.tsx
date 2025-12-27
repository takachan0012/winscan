'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PriceDataPoint {
  timestamp: number;
  price_usd: number;
  price_paxi: number;
}

interface PriceChange {
  change_percent: number;
  change_absolute: number;
}

interface PRC20PriceChartProps {
  contractAddress: string;
  symbol: string;
}

type Timeframe = '1h' | '24h' | '7d' | '30d';

export default function PRC20PriceChart({ 
  contractAddress, 
  symbol
}: PRC20PriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<PriceDataPoint[]>([]);
  const [priceChange, setPriceChange] = useState<PriceChange | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('24h');

  useEffect(() => {
    fetchPriceHistory();
    const interval = setInterval(fetchPriceHistory, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [contractAddress, selectedTimeframe]);

  const fetchPriceHistory = async () => {
    try {
      const response = await fetch(
        `/api/prc20-price-history/${contractAddress}?timeframe=${selectedTimeframe}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setPriceHistory(data.history || []);
        setPriceChange(data.price_change);
        
        if (data.history && data.history.length > 0) {
          setCurrentPrice(data.history[data.history.length - 1].price_paxi);
        }
      }
    } catch (error) {
      console.error('Failed to fetch price history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price < 0.000001) return price.toExponential(4);
    if (price < 0.01) return price.toFixed(8);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(4);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    if (selectedTimeframe === '1h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    if (selectedTimeframe === '24h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTooltipTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Transform data for Recharts - sort by timestamp ascending (oldest to newest)
  const chartData = [...priceHistory]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(point => ({
      time: point.timestamp,
      price: point.price_paxi,
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-gray-400 text-xs mb-1">{formatTooltipTime(data.time)}</p>
          <p className="text-white font-bold text-sm">{formatPrice(data.price)} PAXI</p>
        </div>
      );
    }
    return null;
  };

  const timeframes: { value: Timeframe; label: string }[] = [
    { value: '1h', label: '1H' },
    { value: '24h', label: '1D' },
    { value: '7d', label: '1W' },
    { value: '30d', label: '1M' },
  ];

  if (loading) {
    return (
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="h-6 bg-gray-700 rounded w-32 animate-pulse"></div>
          <div className="flex gap-1 md:gap-2">
            {timeframes.map((tf) => (
              <div key={tf.value} className="flex-1 md:flex-none w-full md:w-12 h-8 bg-gray-700 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
        <div className="h-40 md:h-48 bg-gray-800 rounded animate-pulse"></div>
      </div>
    );
  }

  if (priceHistory.length < 2) {
    return (
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            <span className="truncate">{symbol} Price Chart</span>
          </h3>
        </div>
        <div className="h-40 md:h-48 flex items-center justify-center text-gray-500 text-sm">
          <p>Insufficient price history data</p>
        </div>
      </div>
    );
  }

  const isPositive = priceChange && priceChange.change_percent >= 0;

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Title and Price */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base md:text-lg font-semibold text-white flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-400 flex-shrink-0" />
              <span className="truncate">{symbol} Price Chart</span>
            </h3>
            <div className="flex flex-wrap items-baseline gap-2 md:gap-3">
              <span className="text-xl md:text-2xl font-bold text-white">{formatPrice(currentPrice)} PAXI</span>
              {priceChange && priceChange.change_percent !== 0 && (
                <div className={`flex items-center gap-1 text-xs md:text-sm font-semibold ${
                  isPositive ? 'text-green-400' : 'text-red-400'
                }`}>
                  {isPositive ? <TrendingUp className="w-3 h-3 md:w-4 md:h-4" /> : <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />}
                  {isPositive ? '+' : ''}{priceChange.change_percent.toFixed(2)}%
                  <span className="text-gray-500">({selectedTimeframe})</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timeframe Selector - Full width on mobile */}
        <div className="flex gap-1 md:gap-2 bg-[#141414] rounded-lg p-1 w-full md:w-auto md:self-end">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setSelectedTimeframe(tf.value)}
              className={`flex-1 md:flex-none px-2 md:px-3 py-1.5 rounded text-xs md:text-sm font-medium transition-all ${
                selectedTimeframe === tf.value
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-40 md:h-48 -mx-2 md:mx-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke="#666"
              tick={{ fill: '#999', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#333' }}
            />
            <YAxis
              tickFormatter={(value) => `${formatPrice(value)}`}
              stroke="#666"
              tick={{ fill: '#999', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#333' }}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#60a5fa"
              strokeWidth={2}
              fill="url(#colorPrice)"
              animationDuration={300}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
