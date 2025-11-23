import { bech32 } from 'bech32';

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data as BufferSource);
    return new Uint8Array(hashBuffer);
  } else {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(Buffer.from(data)).digest();
    return new Uint8Array(hash);
  }
}

export async function pubkeyToHexAddress(pubkeyBase64: string): Promise<string> {
  try {
    const pubkeyBytes = Uint8Array.from(atob(pubkeyBase64), c => c.charCodeAt(0));
    const hash = await sha256(pubkeyBytes);
    const address = hash.slice(0, 20);
    return Array.from(address)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  } catch (error) {
    console.error('Error converting pubkey to hex address:', error);
    return '';
  }
}

export async function pubkeyToConsensusAddress(pubkeyBase64: string, prefix: string): Promise<string> {
  try {
    const pubkeyBytes = Uint8Array.from(atob(pubkeyBase64), c => c.charCodeAt(0));
    const hash = await sha256(pubkeyBytes);
    const address = hash.slice(0, 20);
    
    const words = bech32.toWords(address);
    return bech32.encode(prefix, words);
  } catch (error) {
    console.error('Error converting pubkey to consensus address:', error);
    return '';
  }
}

export async function getConsensusAddressesFromPubkey(
  consensusPubkey: any,
  chainPrefix: string
): Promise<{ consensusAddress: string; hexAddress: string }> {
  if (!consensusPubkey || !consensusPubkey.key) {
    return { consensusAddress: '', hexAddress: '' };
  }

  const pubkeyBase64 = consensusPubkey.key;
  const consensusPrefix = `${chainPrefix}valcons`;

  try {
    const [consensusAddress, hexAddress] = await Promise.all([
      pubkeyToConsensusAddress(pubkeyBase64, consensusPrefix),
      pubkeyToHexAddress(pubkeyBase64)
    ]);

    return {
      consensusAddress,
      hexAddress
    };
  } catch (error) {
    console.error('Error getting consensus addresses:', error);
    return { consensusAddress: '', hexAddress: '' };
  }
}
