import { bech32 } from 'bech32';

export function convertValidatorToAccountAddress(validatorAddress: string): string {
  try {
    const decoded = bech32.decode(validatorAddress);
    const operatorPrefix = decoded.prefix;
    let accountPrefix = operatorPrefix;
    if (operatorPrefix.endsWith('valoper')) {
      accountPrefix = operatorPrefix.slice(0, -7);
    }
    const accountAddress = bech32.encode(accountPrefix, decoded.words);
    return accountAddress;
  } catch (err) {
    return '';
  }
}

export function convertAccountToValidatorAddress(accountAddress: string): string {
  try {
    const decoded = bech32.decode(accountAddress);
    const accountPrefix = decoded.prefix;
    const validatorPrefix = `${accountPrefix}valoper`;
    const validatorAddress = bech32.encode(validatorPrefix, decoded.words);
    return validatorAddress;
  } catch (err) {
    return '';
  }
}

/**
 * Convert Ethereum hex address (0x...) to Cosmos bech32 address
 * Used for EVM-compatible chains like Warden, Evmos, Kii, etc.
 */
export function ethToBech32(ethAddress: string, prefix: string = 'warden'): string {
  try {
    // Remove 0x prefix if present
    const cleanHex = ethAddress.replace(/^0x/i, '');
    
    // Convert hex to bytes
    const bytes = Buffer.from(cleanHex, 'hex');
    
    // Convert to 5-bit words for bech32
    const words = bech32.toWords(bytes);
    
    // Encode to bech32
    const bech32Address = bech32.encode(prefix, words);
    
    return bech32Address;
  } catch (err) {
    console.error('Error converting eth to bech32:', err);
    return '';
  }
}

/**
 * Convert Cosmos bech32 address to Ethereum hex address (0x...)
 * Used for EVM-compatible chains like Warden, Evmos, Kii, etc.
 */
export function bech32ToEth(bech32Address: string): string {
  try {
    // Decode bech32
    const decoded = bech32.decode(bech32Address);
    
    // Convert 5-bit words to bytes
    const bytes = Buffer.from(bech32.fromWords(decoded.words));
    
    // Convert to hex with 0x prefix
    const ethAddress = '0x' + bytes.toString('hex');
    
    return ethAddress;
  } catch (err) {
    console.error('Error converting bech32 to eth:', err);
    return '';
  }
}

/**
 * Detect address type and return format info
 */
export function detectAddressType(address: string): {
  type: 'bech32' | 'eth' | 'unknown';
  prefix?: string;
} {
  if (address.startsWith('0x') && /^0x[0-9a-fA-F]{40}$/.test(address)) {
    return { type: 'eth' };
  }
  
  try {
    const decoded = bech32.decode(address);
    return { type: 'bech32', prefix: decoded.prefix };
  } catch {
    return { type: 'unknown' };
  }
}

/**
 * Convert address to both formats if it's an EVM-compatible chain
 */
export function getAddressVariants(address: string, chainPrefix: string = 'warden'): {
  bech32: string;
  eth: string;
  original: string;
  type: 'bech32' | 'eth' | 'unknown';
} {
  const detected = detectAddressType(address);
  
  if (detected.type === 'eth') {
    return {
      bech32: ethToBech32(address, chainPrefix),
      eth: address,
      original: address,
      type: 'eth'
    };
  } else if (detected.type === 'bech32') {
    return {
      bech32: address,
      eth: bech32ToEth(address),
      original: address,
      type: 'bech32'
    };
  }
  
  return {
    bech32: '',
    eth: '',
    original: address,
    type: 'unknown'
  };
}
