/**
 * Auto-Compound Storage Management
 * Stores and retrieves auto-compound status for validators
 * Supports both Cosmos (type 118) and EVM (type 60) chains
 */

interface AutoCompoundStatus {
  validatorAddress: string;
  chainId: string;
  chainCoinType: number; // 118 for Cosmos, 60 for EVM
  enabled: boolean;
  enabledAt: number;
  granterAddress: string; // Wallet address that enabled auto-compound
  granteeAddress: string; // Bot address that will execute auto-compound
  settings: {
    minAmount: string; // Minimum amount to compound (in tokens)
    frequency: 'minutely' | 'hourly' | 'daily' | 'weekly' | 'monthly'; // How often to compound
    duration: number; // Duration in months/years
    durationUnit: 'month' | 'year'; // Unit for duration
  };
}

const STORAGE_KEY = 'autocompound_status';

/**
 * Save auto-compound status for a validator with settings
 */
export function saveAutoCompoundStatus(
  chainId: string,
  validatorAddress: string,
  enabled: boolean,
  chainCoinType: number = 118,
  settings: AutoCompoundStatus['settings'] = {
    minAmount: '0',
    frequency: 'daily',
    duration: 1,
    durationUnit: 'year'
  },
  granteeAddress: string = 'auto',
  granterAddress: string = ''
): void {
  try {
    const key = `${STORAGE_KEY}_${chainId}`;
    const existing = localStorage.getItem(key);
    const data: AutoCompoundStatus[] = existing ? JSON.parse(existing) : [];
    
    // Remove existing entry if any
    const filtered = data.filter(
      item => item.validatorAddress !== validatorAddress
    );
    
    // Add new entry
    if (enabled) {
      filtered.push({
        validatorAddress,
        chainId,
        chainCoinType,
        enabled,
        enabledAt: Date.now(),
        granterAddress,
        granteeAddress,
        settings
      });
    }
    
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error saving auto-compound status:', error);
  }
}

/**
 * Check if auto-compound is enabled for a validator
 * Optionally verify it's enabled by a specific wallet address
 */
export function isAutoCompoundEnabled(
  chainId: string,
  validatorAddress: string,
  granterAddress?: string
): boolean {
  try {
    const key = `${STORAGE_KEY}_${chainId}`;
    const data = localStorage.getItem(key);
    
    if (!data) return false;
    
    const statuses: AutoCompoundStatus[] = JSON.parse(data);
    let status = statuses.find(
      item => item.validatorAddress === validatorAddress
    );
    
    // If granterAddress is provided, verify it matches
    if (status && granterAddress) {
      if (status.granterAddress !== granterAddress) {
        return false; // Enabled by different wallet
      }
    }
    
    return status?.enabled || false;
  } catch (error) {
    console.error('Error checking auto-compound status:', error);
    return false;
  }
}

/**
 * Get auto-compound status details for a validator
 */
export function getAutoCompoundStatus(
  chainId: string,
  validatorAddress: string
): AutoCompoundStatus | null {
  try {
    const key = `${STORAGE_KEY}_${chainId}`;
    const data = localStorage.getItem(key);
    
    if (!data) return null;
    
    const statuses: AutoCompoundStatus[] = JSON.parse(data);
    return statuses.find(
      item => item.validatorAddress === validatorAddress
    ) || null;
  } catch (error) {
    console.error('Error getting auto-compound status:', error);
    return null;
  }
}

/**
 * Get all auto-compound enabled validators for a chain
 */
export function getAutoCompoundValidators(chainId: string): AutoCompoundStatus[] {
  try {
    const key = `${STORAGE_KEY}_${chainId}`;
    const data = localStorage.getItem(key);
    
    if (!data) return [];
    
    const statuses: AutoCompoundStatus[] = JSON.parse(data);
    return statuses.filter(item => item.enabled);
  } catch (error) {
    console.error('Error getting auto-compound validators:', error);
    return [];
  }
}

/**
 * Get all auto-compound enabled validators addresses for a chain
 */
export function getAutoCompoundValidatorAddresses(chainId: string): string[] {
  const validators = getAutoCompoundValidators(chainId);
  return validators.map(item => item.validatorAddress);
}

/**
 * Clear all auto-compound data for a chain
 */
export function clearAutoCompoundData(chainId: string): void {
  try {
    const key = `${STORAGE_KEY}_${chainId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing auto-compound data:', error);
  }
}
