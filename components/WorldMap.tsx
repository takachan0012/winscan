'use client';

import { useEffect, useRef } from 'react';

interface Node {
  address: string;
  location: {
    country: string;
    city: string;
    lat: number;
    lng: number;
  };
  status: 'online' | 'offline';
}

interface WorldMapProps {
  nodes: Node[];
}

export default function WorldMap({ nodes }: WorldMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const width = canvas.width;
    const height = canvas.height;

    // Clear and fill background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw ocean
    ctx.fillStyle = '#0f1419';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    
    // Latitude lines
    for (let i = 0; i <= 180; i += 30) {
      const y = (i / 180) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Longitude lines
    for (let i = 0; i <= 360; i += 30) {
      const x = (i / 360) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw simplified continents
    ctx.fillStyle = '#1a2332';
    ctx.strokeStyle = '#2a3a4a';
    ctx.lineWidth = 2;

    // North America
    ctx.beginPath();
    ctx.moveTo(width * 0.15, height * 0.15);
    ctx.lineTo(width * 0.25, height * 0.2);
    ctx.lineTo(width * 0.28, height * 0.35);
    ctx.lineTo(width * 0.22, height * 0.4);
    ctx.lineTo(width * 0.15, height * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // South America
    ctx.beginPath();
    ctx.moveTo(width * 0.25, height * 0.45);
    ctx.lineTo(width * 0.28, height * 0.5);
    ctx.lineTo(width * 0.26, height * 0.65);
    ctx.lineTo(width * 0.23, height * 0.7);
    ctx.lineTo(width * 0.22, height * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Europe
    ctx.beginPath();
    ctx.moveTo(width * 0.48, height * 0.15);
    ctx.lineTo(width * 0.55, height * 0.18);
    ctx.lineTo(width * 0.54, height * 0.28);
    ctx.lineTo(width * 0.48, height * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Africa
    ctx.beginPath();
    ctx.moveTo(width * 0.48, height * 0.32);
    ctx.lineTo(width * 0.55, height * 0.35);
    ctx.lineTo(width * 0.56, height * 0.6);
    ctx.lineTo(width * 0.52, height * 0.65);
    ctx.lineTo(width * 0.47, height * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Asia
    ctx.beginPath();
    ctx.moveTo(width * 0.56, height * 0.12);
    ctx.lineTo(width * 0.75, height * 0.15);
    ctx.lineTo(width * 0.78, height * 0.25);
    ctx.lineTo(width * 0.75, height * 0.4);
    ctx.lineTo(width * 0.65, height * 0.42);
    ctx.lineTo(width * 0.58, height * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Australia
    ctx.beginPath();
    ctx.moveTo(width * 0.75, height * 0.6);
    ctx.lineTo(width * 0.82, height * 0.62);
    ctx.lineTo(width * 0.81, height * 0.72);
    ctx.lineTo(width * 0.76, height * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw nodes as pins
    nodes.forEach(node => {
      // Convert lat/lng to canvas coordinates
      const x = ((node.location.lng + 180) / 360) * width;
      const y = ((90 - node.location.lat) / 180) * height;

      // Draw pin
      const pinRadius = 8;
      const pinColor = node.status === 'online' ? '#3b82f6' : '#ef4444';
      
      // Pin outer glow (larger)
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, pinRadius * 4);
      gradient.addColorStop(0, `${pinColor}44`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, pinRadius * 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Pin inner glow
      ctx.fillStyle = `${pinColor}66`;
      ctx.beginPath();
      ctx.arc(x, y, pinRadius * 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Pin circle
      ctx.fillStyle = pinColor;
      ctx.beginPath();
      ctx.arc(x, y, pinRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Pin border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, pinRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw city label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.location.city, x, y - pinRadius - 5);
    });

  }, [nodes]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full"
      style={{ background: '#0a0a0a' }}
    />
  );
}
