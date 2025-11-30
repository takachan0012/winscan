/**
 * Get token logo from Cosmos Chain Registry
 * https://github.com/cosmos/chain-registry
 */

interface ChainRegistryAsset {
  symbol: string;
  logo_URIs?: {
    png?: string;
    svg?: string;
  };
  images?: Array<{
    png?: string;
    svg?: string;
  }>;
}

// Map common chain names to their chain registry names
const CHAIN_NAME_MAP: Record<string, string> = {
  'cosmoshub-mainnet': 'cosmoshub',
  'cosmoshub-test': 'cosmoshubtestnet',
  'osmosis-mainnet': 'osmosis',
  'osmosis-test': 'osmosistestnet',
  'noble-mainnet': 'noble',
  'noble-test': 'nobletestnet',
  'paxi-mainnet': 'paxinetwork',
  'warden-mainnet': 'warden',
  'warden-test': 'wardentestnet',
  'zenrock-mainnet': 'zenrock',
  'lava-mainnet': 'lava',
  'sunrise-mainnet': 'sunrise',
  'atomone-mainnet': 'atomone',
  'atomone-test': 'atomonetestnet',
  'bitbadges-1': 'bitbadges',
  'shido-mainnet': 'shido',
  'humans-mainnet': 'humans',
  'gitopia-mainnet': 'gitopia',
  'axone-mainnet': 'axone',
  'tellor-mainnet': 'tellor',
  'lumera-mainnet': 'lumera',
};

// Common token symbol to source chain mapping
const TOKEN_SOURCE_CHAIN: Record<string, string> = {
  'ATOM': 'cosmoshub',
  'OSMO': 'osmosis',
  'USDC': '_non-cosmos/ethereum',
  'USDT': '_non-cosmos/ethereum',
  'BADGE': 'bitbadges',
  'TIA': 'celestia',
  'DYDX': 'dydx',
  'INJ': 'injective',
  'AKT': 'akash',
  'JUNO': 'juno',
  'STARS': 'stargaze',
  'EVMOS': 'evmos',
  'CANTO': 'canto',
  'SCRT': 'secretnetwork',
  'CRO': 'cryptoorgchain',
  'REGEN': 'regen',
  'SOMM': 'sommelier',
  'UMEE': 'umee',
  'CMDX': 'comdex',
  'KUJI': 'kujira',
  'FURY': 'fanfury',
  'LUNA': 'terra2',
  'LUNC': 'terra',
  'USTC': 'terra',
  'STRD': 'stride',
  'GRAV': 'gravity',
  'CHEQ': 'cheqd',
  'BAND': 'bandchain',
  'FET': 'fetchhub',
  'WARDEN': 'warden',
  'WETH': '_non-cosmos/ethereum',
  'DAI': '_non-cosmos/ethereum',
  'WMATIC': '_non-cosmos/polygon',
  'MATIC': '_non-cosmos/polygon',
  'WBTC': '_non-cosmos/ethereum',
  'BTC': '_non-cosmos/bitcoin',
  'ETH': '_non-cosmos/ethereum',
  'XAUT': '_non-cosmos/ethereum', // Tether Gold
  'TRX': '_non-cosmos/tron',
  'SOL': '_non-cosmos/solana',
  'BNB': '_non-cosmos/binancesmartchain',
  'AVAX': '_non-cosmos/avalanche',
  'FTM': '_non-cosmos/fantom',
};

// Special filename mappings for tokens that don't follow standard {symbol}.png pattern
const SPECIAL_FILENAMES: Record<string, string> = {
  'ETH': 'eth-white.png',
  'SOL': 'sol_circle.png',
  'XRP': 'xrp.png', // Note: XRP may not exist in registry
  'LUME': 'lumera.png',
};

// Custom logo URLs for tokens not in chain registry
const CUSTOM_LOGOS: Record<string, string> = {
  'PAXI': 'https://file.winsnip.xyz/file/uploads/paxi.jpg',
};

/**
 * Get direct logo URL from Cosmos Chain Registry (synchronous)
 * For IBC tokens, tries to find logo from source chain
 */
export function getChainRegistryLogoUrl(
  chainName: string,
  symbol: string
): string {
  // Clean symbol
  let cleanSymbol = symbol.toUpperCase().trim();
  
  // Check custom logos first
  if (CUSTOM_LOGOS[cleanSymbol]) {
    return CUSTOM_LOGOS[cleanSymbol];
  }
  
  // Remove IBC/ prefix if exists
  cleanSymbol = cleanSymbol.replace('IBC/', '');
  
  // Skip GAMM pool tokens and factory tokens - no logo available
  if (cleanSymbol.startsWith('GAMM/') || cleanSymbol.includes('POOL') || cleanSymbol.startsWith('FACTORY/')) {
    return '';
  }
  
  // Remove 'U' prefix for micro denominations (UATOM -> ATOM, UOSMO -> OSMO, UBADGE -> BADGE)
  // Common pattern: uatom, uosmo, ubadge, uusdc, etc.
  if (cleanSymbol.startsWith('U') && cleanSymbol.length > 2) {
    const withoutU = cleanSymbol.substring(1);
    // Check if removing 'U' results in a known token
    if (TOKEN_SOURCE_CHAIN[withoutU] || withoutU === 'BADGE' || withoutU === 'USDC' || withoutU === 'USDT') {
      cleanSymbol = withoutU;
    }
  }
  
  // Check if it's a known cross-chain token, use source chain
  let targetChain = TOKEN_SOURCE_CHAIN[cleanSymbol];
  
  // If not found in mapping, use current chain
  if (!targetChain) {
    targetChain = CHAIN_NAME_MAP[chainName] || chainName.replace(/-mainnet|-test/g, '');
  }
  
  const symbolLower = cleanSymbol.toLowerCase();
  
  // Check if token has special filename
  const specialFilename = SPECIAL_FILENAMES[cleanSymbol];
  const filename = specialFilename || `${symbolLower}.png`;
  
  // Return URL with appropriate filename
  return `https://raw.githubusercontent.com/cosmos/chain-registry/master/${targetChain}/images/${filename}`;
}

// Cache untuk async function
const logoCache = new Map<string, string>();

/**
 * Get token logo URL from Cosmos Chain Registry
 * @param chainName - Chain name (e.g., 'osmosis-mainnet')
 * @param symbol - Token symbol (e.g., 'OSMO', 'ATOM')
 * @returns Logo URL or empty string
 */
export async function getChainRegistryLogo(
  chainName: string,
  symbol: string
): Promise<string> {
  const cacheKey = `${chainName}:${symbol}`;
  
  // Check cache first
  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey)!;
  }

  try {
    // Map chain name to registry name
    const registryChainName = CHAIN_NAME_MAP[chainName] || chainName.replace(/-mainnet|-test/g, '');
    
    // Fetch assetlist from chain registry
    const url = `https://raw.githubusercontent.com/cosmos/chain-registry/master/${registryChainName}/assetlist.json`;
    const response = await fetch(url, { 
      next: { revalidate: 86400 } // Cache for 24 hours
    });

    if (!response.ok) {
      console.log(`Chain registry not found for ${registryChainName}`);
      return '';
    }

    const data = await response.json();
    const assets: ChainRegistryAsset[] = data.assets || [];

    // Find asset by symbol (case-insensitive)
    const asset = assets.find(
      (a) => a.symbol.toLowerCase() === symbol.toLowerCase()
    );

    if (!asset) {
      return '';
    }

    // Priority: PNG > SVG from logo_URIs, then images array
    let logoUrl = '';
    
    if (asset.logo_URIs?.png) {
      logoUrl = asset.logo_URIs.png;
    } else if (asset.logo_URIs?.svg) {
      logoUrl = asset.logo_URIs.svg;
    } else if (asset.images && asset.images.length > 0) {
      logoUrl = asset.images[0].png || asset.images[0].svg || '';
    }

    // Cache result
    if (logoUrl) {
      logoCache.set(cacheKey, logoUrl);
    }

    return logoUrl;
  } catch (error) {
    console.error(`Error fetching logo for ${chainName}:${symbol}`, error);
    return '';
  }
}

/**
 * Get token logo URL synchronously from cache
 * Use this after calling getChainRegistryLogo first
 */
export function getCachedLogo(chainName: string, symbol: string): string {
  const cacheKey = `${chainName}:${symbol}`;
  return logoCache.get(cacheKey) || '';
}

/**
 * Prefetch logos for multiple tokens
 */
export async function prefetchLogos(
  chainName: string,
  symbols: string[]
): Promise<void> {
  const promises = symbols.map((symbol) =>
    getChainRegistryLogo(chainName, symbol)
  );
  await Promise.all(promises);
}
