'use client';
import { useEffect, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';
interface TransactionHistoryChartProps {
  data?: { date: string; count: number }[];
}

type TimeRange = '1d' | '7d' | '30d' | '1y';

export default function TransactionHistoryChart({ data }: TransactionHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('1d');
  const getDaysCount = () => {
    switch (timeRange) {
      case '1d': return 1;
      case '7d': return 7;
      case '30d': return 30;
      case '1y': return 365;
      default: return 30;
    }
  };

  const getLabel = () => {
    switch (timeRange) {
      case '1d': return '1 Day';
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


    let chartData;
    
    if (timeRange === '1d' && data && data.length > 0) {

      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      
      chartData = data
        .filter(d => new Date(d.date) >= oneDayAgo)
        .slice(0, 30)
        .reverse();

      if (chartData.length === 0 && data.length > 0) {
        chartData = data.slice(0, Math.min(10, data.length)).reverse();
      }
    } else {

      chartData = data && data.length > 0 
        ? data.slice(0, daysCount).reverse() 
        : Array.from({ length: daysCount }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (daysCount - 1 - i));
            return {
              date: date.toISOString(),
              count: 0
            };
          });
    }

    if (chartData.length < 2) {
      const now = new Date();
      chartData = [
        { date: new Date(now.getTime() - 3600000).toISOString(), count: 0 },
        { date: now.toISOString(), count: chartData[0]?.count || 0 }
      ];
    }
    
    if (timeRange !== '1d' && chartData.length < daysCount) {
      const missing = daysCount - chartData.length;
      const oldestDate = new Date(chartData[0].date);
      const fillerData = Array.from({ length: missing }, (_, i) => {
        const date = new Date(oldestDate);
        date.setDate(date.getDate() - (missing - i));
        return {
          date: date.toISOString(),
          count: 0
        };
      });
      chartData = [...fillerData, ...chartData];
    }
    
    console.log('[TransactionChart] Rendering with data:', chartData.slice(0, 3));
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    ctx.clearRect(0, 0, width, height);
    const maxCount = Math.max(...chartData.map(d => d.count), 1);
    const minCount = 0;
    const range = maxCount - minCount;
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();
      const value = Math.round(maxCount - (range / gridLines) * i);
      ctx.fillStyle = '#888';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value.toString(), padding.left - 10, y + 4);
    }
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
    ctx.beginPath();
    chartData.forEach((point, i) => {
      const x = padding.left + (chartWidth / (chartData.length - 1)) * i;
      const y = padding.top + chartHeight - ((point.count - minCount) / range) * chartHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    const lastX = padding.left + chartWidth;
    const baseY = padding.top + chartHeight;
    ctx.lineTo(lastX, baseY);
    ctx.lineTo(padding.left, baseY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.beginPath();
    chartData.forEach((point, i) => {
      const x = padding.left + (chartWidth / (chartData.length - 1)) * i;
      const y = padding.top + chartHeight - ((point.count - minCount) / range) * chartHeight;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();
    chartData.forEach((point, i) => {
      const x = padding.left + (chartWidth / (chartData.length - 1)) * i;
      const y = padding.top + chartHeight - ((point.count - minCount) / range) * chartHeight;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#0f0f0f';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    ctx.fillStyle = '#888';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const labelInterval = timeRange === '1y' ? 30 : (timeRange === '30d' ? 5 : (timeRange === '1d' ? 3 : 1));
    chartData.forEach((point, i) => {
      if (i % labelInterval === 0 || i === chartData.length - 1) {
        const x = padding.left + (chartWidth / (chartData.length - 1)) * i;
        const date = new Date(point.date);
        let label;
        
        if (timeRange === '1d') {

          label = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        } else if (timeRange === '1y') {
          label = `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
        } else {
          label = `${date.getMonth() + 1}/${date.getDate()}`;
        }
        
        ctx.fillText(label, x, height - 20);
      }
    });
  }, [data, timeRange]);
  return (
    <div className="bg-card border border-theme rounded-lg p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-theme flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-primary" />
          Transaction History ({getLabel()})
        </h3>
        <div className="flex items-center gap-4">
          <div className="text-sm text-dim">
            Total: {(data || []).reduce((sum, d) => sum + d.count, 0).toLocaleString()}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange('1d')}
              className={`px-3 py-1 text-xs rounded transition-all ${
                timeRange === '1d'
                  ? 'bg-primary text-primary-text font-semibold'
                  : 'bg-surface border border-theme text-dim hover:border-primary'
              }`}
            >
              1D
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 text-xs rounded transition-all ${
                timeRange === '7d'
                  ? 'bg-primary text-primary-text font-semibold'
                  : 'bg-surface border border-theme text-dim hover:border-primary'
              }`}
            >
              7D
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1 text-xs rounded transition-all ${
                timeRange === '30d'
                  ? 'bg-primary text-primary-text font-semibold'
                  : 'bg-surface border border-theme text-dim hover:border-primary'
              }`}
            >
              30D
            </button>
            <button
              onClick={() => setTimeRange('1y')}
              className={`px-3 py-1 text-xs rounded transition-all ${
                timeRange === '1y'
                  ? 'bg-primary text-primary-text font-semibold'
                  : 'bg-surface border border-theme text-dim hover:border-primary'
              }`}
            >
              1Y
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full"
          style={{ minHeight: '200px' }}
        />
      </div>
    </div>
  );
}
