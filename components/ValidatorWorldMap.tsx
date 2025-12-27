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

// Fallback coordinates for countries (capital cities)
const countryCoordinates: Record<string, [number, number]> = {
  'Germany': [13.4050, 52.5200],
  'Finland': [24.9384, 60.1699],
  'Singapore': [103.8198, 1.3521],
  'Canada': [-75.6972, 45.4215],
  'Vietnam': [105.8342, 21.0278],
  'France': [2.3522, 48.8566],
  'Poland': [21.0122, 52.2297],
  'United States': [-77.0369, 38.9072],
  'Netherlands': [4.9041, 52.3676],
  'United Kingdom': [-0.1276, 51.5074],
  'Japan': [139.6917, 35.6895],
  'Australia': [151.2093, -33.8688],
  'Brazil': [-47.8825, -15.7942],
  'India': [77.2090, 28.6139],
  'China': [116.4074, 39.9042],
  'South Korea': [126.9780, 37.5665],
  'Russia': [37.6173, 55.7558],
  'Austria': [16.3713, 48.2081],
  'Hong Kong': [114.1693, 22.3193],
};

const ValidatorWorldMap: React.FC<ValidatorWorldMapProps> = ({ locations }) => {
  // Log untuk debugging
  console.log('[ValidatorWorldMap] Total locations received:', locations.length);
  if (locations.length > 0) {
    console.log('[ValidatorWorldMap] Sample location data:', JSON.stringify(locations[0], null, 2));
    console.log('[ValidatorWorldMap] All location keys:', Object.keys(locations[0]));
  }
  
  // Transform and fix locations with coordinates
  const validLocations = locations.map((loc: any) => {
    // Check if backend sends latitude/longitude separately
    if (loc.latitude !== undefined && loc.longitude !== undefined && 
        typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
      // Convert to coordinates array [longitude, latitude] (GeoJSON format)
      return { 
        ...loc, 
        coordinates: [loc.longitude, loc.latitude] as [number, number]
      };
    }
    
    // If coordinates array exists and valid, use it
    if (loc.coordinates && 
        Array.isArray(loc.coordinates) && 
        loc.coordinates.length === 2 &&
        typeof loc.coordinates[0] === 'number' && 
        typeof loc.coordinates[1] === 'number' &&
        !isNaN(loc.coordinates[0]) &&
        !isNaN(loc.coordinates[1])) {
      return loc;
    }
    
    // Try to get fallback coordinates from country
    const fallbackCoords = countryCoordinates[loc.country];
    if (fallbackCoords) {
      console.log(`[ValidatorWorldMap] Using fallback coordinates for ${loc.city}, ${loc.country}`);
      return { ...loc, coordinates: fallbackCoords };
    }
    
    console.warn('[ValidatorWorldMap] No coordinates for location:', loc);
    return null;
  }).filter((loc): loc is ValidatorLocation => loc !== null);
  
  console.log('[ValidatorWorldMap] Valid locations after filtering:', validLocations.length);
  
  if (validLocations.length === 0) {
    return (
      <div className="w-full h-[600px] bg-[#0d1829] rounded-lg border border-gray-800 overflow-hidden relative flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-lg font-bold mb-2">No Validator Locations Available</p>
          <p className="text-gray-400 text-sm">Validator location data has not been indexed yet</p>
        </div>
      </div>
    );
  }
  
  const sortedLocations = [...validLocations].sort((a, b) => b.count - a.count);
  const mainHub = sortedLocations[0];
  const [selectedLocation, setSelectedLocation] = useState<ValidatorLocation | null>(null);
  
  // Create country color map based on validator count
  const countryValidatorCount = validLocations.reduce((acc, loc) => {
    acc[loc.country] = (acc[loc.country] || 0) + loc.count;
    return acc;
  }, {} as Record<string, number>);
  
  const maxValidators = Math.max(...Object.values(countryValidatorCount));
  
  const getCountryColor = (countryName: string) => {
    const count = countryValidatorCount[countryName] || 0;
    if (count === 0) return '#1e3a5f'; // Default dark blue
    
    const intensity = count / maxValidators;
    if (intensity > 0.7) return '#3b82f6'; // Bright blue for high count
    if (intensity > 0.4) return '#2563eb'; // Medium blue
    if (intensity > 0.2) return '#1d4ed8'; // Lower blue
    return '#1e40af'; // Dark blue
  };
  
  return (
    <div className="w-full h-[600px] bg-[#0d1829] rounded-lg border border-gray-800 overflow-hidden relative">
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
              geographies.map((geo) => {
                const countryName = geo.properties.name;
                const fillColor = getCountryColor(countryName);
                const hasValidators = countryValidatorCount[countryName] > 0;
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillColor}
                    stroke={hasValidators ? "#60a5fa" : "#3b82f6"}
                    strokeWidth={hasValidators ? 0.8 : 0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: { fill: hasValidators ? '#60a5fa' : '#2563eb', outline: 'none' },
                      pressed: { outline: 'none' }
                    }}
                  />
                );
              })
            }
          </Geographies>
          
          {mainHub && sortedLocations.slice(1).map((location, i) => (
            <Line
              key={`hub-${i}`}
              from={mainHub.coordinates}
              to={location.coordinates}
              stroke="#22d3ee"
              strokeWidth={1.5}
              strokeLinecap="round"
              className="connection-line"
            />
          ))}
          
          {validLocations.map((location, index) => {
            const isMainHub = mainHub && location.city === mainHub.city && location.country === mainHub.country;
            
            return (
              <Marker 
                key={index} 
                coordinates={location.coordinates}
                onClick={() => {
                  console.log('[ValidatorWorldMap] ======= CLICKED LOCATION =======');
                  console.log('[ValidatorWorldMap] Location data:', JSON.stringify(location, null, 2));
                  console.log('[ValidatorWorldMap] Monikers:', location.monikers);
                  console.log('[ValidatorWorldMap] Monikers type:', typeof location.monikers);
                  console.log('[ValidatorWorldMap] Monikers is array?', Array.isArray(location.monikers));
                  console.log('[ValidatorWorldMap] ================================');
                  setSelectedLocation(location);
                }}
              >
                <g transform="translate(0, -12)" style={{ cursor: 'pointer' }}>
                  {isMainHub && (
                    <circle
                      r={15}
                      fill="#22d3ee"
                      fillOpacity={0.3}
                      className="animate-ping"
                      style={{ animationDuration: '2s' }}
                    />
                  )}
                  <path
                    d="M0,-8 C-3,-8 -5,-6 -5,-3 C-5,0 0,8 0,8 C0,8 5,0 5,-3 C5,-6 3,-8 0,-8 Z"
                    fill={isMainHub ? "#06b6d4" : "#22d3ee"}
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
        <p className="text-blue-400 text-xs">{validLocations.length} locations</p>
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
          
          {selectedLocation.monikers && selectedLocation.monikers.length > 0 ? (
            <div>
              <p className="text-gray-400 text-xs mb-2">Validators ({selectedLocation.monikers.length})</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {selectedLocation.monikers.map((moniker, i) => (
                  <div key={i} className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 hover:border-gray-600 transition-colors">
                    {moniker}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
              <p className="text-yellow-400 text-xs">⚠️ Validator monikers data not available from backend</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(ValidatorWorldMap);
