/**
 * IBC Channel mappings between chains
 * Source: Chain registry IBC data
 */

export interface IBCChannel {
  channelId: string; // Source chain channel
  counterpartyChannelId: string; // Destination chain channel
  port?: string; // Default: 'transfer'
}

export interface IBCChannelMap {
  [sourceChain: string]: {
    [destChain: string]: IBCChannel;
  };
}

/**
 * IBC channel mappings
 * Format: sourceChain -> destChain -> { channelId, counterpartyChannelId }
 */
export const IBC_CHANNELS: IBCChannelMap = {
  // Paxi Mainnet
  'paxi-mainnet': {
    'noble-mainnet': {
      channelId: 'channel-2',
      counterpartyChannelId: 'channel-100', // Example, needs verification
    },
    'cosmoshub-mainnet': {
      channelId: 'channel-0',
      counterpartyChannelId: 'channel-500', // Example, needs verification
    },
    'osmosis-mainnet': {
      channelId: 'channel-1',
      counterpartyChannelId: 'channel-800', // Example, needs verification
    },
  },

  // Cosmoshub Mainnet
  'cosmoshub-mainnet': {
    'osmosis-mainnet': {
      channelId: 'channel-141',
      counterpartyChannelId: 'channel-0',
    },
    'noble-mainnet': {
      channelId: 'channel-536',
      counterpartyChannelId: 'channel-4',
    },
    'paxi-mainnet': {
      channelId: 'channel-500', // Example, needs verification
      counterpartyChannelId: 'channel-0',
    },
  },

  // Osmosis Mainnet
  'osmosis-mainnet': {
    'cosmoshub-mainnet': {
      channelId: 'channel-0',
      counterpartyChannelId: 'channel-141',
    },
    'noble-mainnet': {
      channelId: 'channel-750',
      counterpartyChannelId: 'channel-1',
    },
    'paxi-mainnet': {
      channelId: 'channel-800', // Example, needs verification
      counterpartyChannelId: 'channel-1',
    },
  },

  // Noble Mainnet
  'noble-mainnet': {
    'cosmoshub-mainnet': {
      channelId: 'channel-4',
      counterpartyChannelId: 'channel-536',
    },
    'osmosis-mainnet': {
      channelId: 'channel-1',
      counterpartyChannelId: 'channel-750',
    },
    'paxi-mainnet': {
      channelId: 'channel-100', // Example, needs verification
      counterpartyChannelId: 'channel-2',
    },
  },

  // KiiChain Test
  'kiichain-test': {
    'osmosis-mainnet': {
      channelId: 'channel-0',
      counterpartyChannelId: 'channel-1000', // Example
    },
  },

  // Lumera Mainnet
  'lumera-mainnet': {
    'osmosis-mainnet': {
      channelId: 'channel-0',
      counterpartyChannelId: 'channel-900', // Example
    },
  },
};

/**
 * Get IBC channel info between two chains
 */
export function getIBCChannel(
  sourceChain: string,
  destChain: string
): IBCChannel | null {
  return IBC_CHANNELS[sourceChain]?.[destChain] || null;
}

/**
 * Get all available destination chains for a source chain
 */
export function getAvailableDestinations(sourceChain: string): string[] {
  return Object.keys(IBC_CHANNELS[sourceChain] || {});
}

/**
 * Check if IBC route exists between two chains
 */
export function hasIBCRoute(sourceChain: string, destChain: string): boolean {
  return !!getIBCChannel(sourceChain, destChain);
}
