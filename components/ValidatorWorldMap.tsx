'use client';

import React, { memo, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
  ZoomableGroup
} from 'react-simple-maps';

interface ValidatorLocation {
  city: string;
  country: string;
  coordinates: [number, number];
  count: number;
  provider?: string;
  monikers?: string[];
}

interface ValidatorWorldMapProps {
  locations: ValidatorLocation[];
}

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const ValidatorWorldMap: React.FC<ValidatorWorldMapProps> = ({ locations }) => {
  const sortedLocations = [...locations].sort((a, b) => b.count - a.count);
  const mainHub = sortedLocations[0];
  const [selectedLocation, setSelectedLocation] = useState<ValidatorLocation | null>(null);
  
  return (
    <div className="w-full h-[600px] bg-[#0a0a0a] rounded-lg border border-gray-800 overflow-hidden relative">
      <style jsx global>{`
        @keyframes flowLine {
          0% {
            stroke-dashoffset: 1000;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.7;
          }
        }
        .connection-line {
          stroke-dasharray: 10 5;
          animation: flowLine 30s linear infinite, pulse 3s ease-in-out infinite;
        }
      `}</style>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 120,
          center: [20, 20]
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup center={[20, 20]} zoom={1}>
          <Geographies geography={geoUrl}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1e293b"
                  stroke="#334155"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: '#334155', outline: 'none' },
                    pressed: { outline: 'none' }
                  }}
                />
              ))
            }
          </Geographies>
          
          {mainHub && locations.slice(1).map((location, i) => (
            <Line
              key={`hub-${i}`}
              from={mainHub.coordinates}
              to={location.coordinates}
              stroke="#60a5fa"
              strokeWidth={1}
              strokeLinecap="round"
              className="connection-line"
            />
          ))}
          
          {locations.map((location, index) => {
            const isMainHub = mainHub && location.city === mainHub.city && location.country === mainHub.country;
            
            return (
              <Marker 
                key={index} 
                coordinates={location.coordinates}
                onClick={() => setSelectedLocation(location)}
              >
                <g transform="translate(0, -12)" style={{ cursor: 'pointer' }}>
                  {isMainHub && (
                    <circle
                      r={15}
                      fill="#60a5fa"
                      fillOpacity={0.2}
                      className="animate-ping"
                      style={{ animationDuration: '2s' }}
                    />
                  )}
                  <path
                    d="M0,-8 C-3,-8 -5,-6 -5,-3 C-5,0 0,8 0,8 C0,8 5,0 5,-3 C5,-6 3,-8 0,-8 Z"
                    fill={isMainHub ? "#f59e0b" : "#60a5fa"}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    className="hover:opacity-80 transition-opacity"
                  />
                  <circle
                    cx={0}
                    cy={-4}
                    r={2.5}
                    fill="#ffffff"
                  />
                  <text
                    textAnchor="middle"
                    y={20}
                    style={{
                      fontFamily: 'system-ui',
                      fontSize: '10px',
                      fill: '#ffffff',
                      fontWeight: 'bold',
                      textShadow: '0 0 3px rgba(0,0,0,0.8)'
                    }}
                  >
                    {location.count}
                  </text>
                </g>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm border border-gray-700 rounded-lg px-4 py-2">
        <p className="text-white text-sm font-bold">Node Data Center</p>
        <p className="text-blue-400 text-xs">{locations.length} locations</p>
      </div>
      
      {selectedLocation && (
        <div className="absolute top-4 right-4 bg-black/90 backdrop-blur-sm border border-gray-700 rounded-lg p-4 w-80 max-h-[500px] overflow-y-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <h3 className="text-white font-bold text-lg">{selectedLocation.city}</h3>
              </div>
              <p className="text-gray-400 text-xs mb-2">{selectedLocation.country}</p>
            </div>
            <button 
              onClick={() => setSelectedLocation(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 mb-3">
            <p className="text-blue-400 text-xs mb-0.5">Total Nodes</p>
            <p className="text-white text-2xl font-bold">{selectedLocation.count}</p>
          </div>
          
          {selectedLocation.provider && selectedLocation.provider !== 'Unknown' && (
            <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 mb-3">
              <p className="text-gray-400 text-xs mb-1">Provider</p>
              <p className="text-white font-semibold">{selectedLocation.provider}</p>
            </div>
          )}
          
          {selectedLocation.monikers && selectedLocation.monikers.length > 0 && (
            <div>
              <p className="text-gray-400 text-xs mb-2">Operators ({selectedLocation.monikers.length})</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {selectedLocation.monikers.map((moniker, i) => (
                  <div key={i} className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 hover:border-gray-600 transition-colors">
                    {moniker}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(ValidatorWorldMap);
