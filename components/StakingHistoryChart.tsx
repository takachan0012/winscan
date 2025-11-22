'use client';
import { useEffect, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';

interface StakingHistoryChartProps {
  data?: { date: string; open: number; high: number; low: number; close: number }[];
}

type TimeRange = '7d' | '30d' | '1y';

export default function StakingHistoryChart({ data }: StakingHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const getDaysCount = () => {
    switch (timeRange) {
      case '7d': return 7;
      case '30d': return 30;
      case '1y': return 365;
      default: return 30;
    }
  };

  const getLabel = () => {
    switch (timeRange) {
      case '7d': return '7 Days';
      case '30d': return '30 Days';
      case '1y': return '1 Year';
      default: return '30 Days';
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const daysCount = getDaysCount();

    // Generate candlestick data with stable values
    let chartData;
    if (data && data.length > 0) {
      chartData = data.slice(0, daysCount).reverse();
    } else {
      // Generate stable mock data - bonded stays relatively constant with minimal daily changes
      const baseValue = 65000000; // 65M base bonded
      const stableData = [];
      
      for (let i = 0; i < daysCount; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (daysCount - 1 - i));
        
        // Very minimal daily change (0.1% max)
        const dailyChange = (Math.random() - 0.5) * 0.001 * baseValue;
        const open = baseValue + dailyChange;
        const close = open + (Math.random() - 0.5) * 0.0005 * baseValue;
        
        // High and low very close to open/close
        const high = Math.max(open, close) * 1.0001;
        const low = Math.min(open, close) * 0.9999;
        
        stableData.push({
          date: date.toISOString(),
          open: Math.round(open),
          high: Math.round(high),
          low: Math.round(low),
          close: Math.round(close)
        });
      }
      
      chartData = stableData;
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // Find max/min for scaling
    const allValues = chartData.flatMap(d => [d.high, d.low]);
    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...allValues);
    const range = maxValue - minValue;

    // Draw grid lines
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      const value = Math.round(maxValue - (range / gridLines) * i);
      ctx.fillStyle = '#888';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText((value / 1000000).toFixed(1) + 'M', padding.left - 10, y + 4);
    }

    // Draw candlesticks
    const candleWidth = Math.max(2, chartWidth / chartData.length - 4);
    
    chartData.forEach((candle, i) => {
      const x = padding.left + (chartWidth / chartData.length) * i + (chartWidth / chartData.length) / 2;
      
      const openY = padding.top + chartHeight - ((candle.open - minValue) / range) * chartHeight;
      const highY = padding.top + chartHeight - ((candle.high - minValue) / range) * chartHeight;
      const lowY = padding.top + chartHeight - ((candle.low - minValue) / range) * chartHeight;
      const closeY = padding.top + chartHeight - ((candle.close - minValue) / range) * chartHeight;
      
      const isGreen = candle.close >= candle.open;
      
      // Draw wick (high-low line)
      ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
      
      // Draw body (open-close rectangle)
      const bodyHeight = Math.abs(closeY - openY);
      const bodyY = Math.min(openY, closeY);
      
      if (isGreen) {
        ctx.fillStyle = '#10b981';
        ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, Math.max(1, bodyHeight));
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, Math.max(1, bodyHeight));
      }
    });

    // Draw x-axis labels
    ctx.fillStyle = '#888';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const labelInterval = timeRange === '1y' ? 30 : (timeRange === '30d' ? 5 : 1);
    chartData.forEach((candle, i) => {
      if (i % labelInterval === 0 || i === chartData.length - 1) {
        const x = padding.left + (chartWidth / chartData.length) * i + (chartWidth / chartData.length) / 2;
        const date = new Date(candle.date);
        let label;
        
        if (timeRange === '1y') {
          label = `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
        } else {
          label = `${date.getMonth() + 1}/${date.getDate()}`;
        }
        
        ctx.fillText(label, x, height - 20);
      }
    });
  }, [data, timeRange]);

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Bonded Tokens ({getLabel()})
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-gray-400">Increase</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-gray-400">Decrease</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 text-xs rounded transition-all ${
                timeRange === '7d'
                  ? 'bg-gray-700 text-white font-semibold'
                  : 'bg-[#0f0f0f] border border-gray-800 text-gray-400 hover:border-gray-600'
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1 text-xs rounded transition-all ${
                timeRange === '30d'
                  ? 'bg-gray-700 text-white font-semibold'
                  : 'bg-[#0f0f0f] border border-gray-800 text-gray-400 hover:border-gray-600'
              }`}
            >
              30D
            </button>
            <button
              onClick={() => setTimeRange('1y')}
              className={`px-3 py-1 text-xs rounded transition-all ${
                timeRange === '1y'
                  ? 'bg-gray-700 text-white font-semibold'
                  : 'bg-[#0f0f0f] border border-gray-800 text-gray-400 hover:border-gray-600'
              }`}
            >
              1Y
            </button>
          </div>
        </div>
      </div>
      <canvas 
        ref={canvasRef} 
        className="w-full"
        style={{ height: '200px' }}
      />
    </div>
  );
}
