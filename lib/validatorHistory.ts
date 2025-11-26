/**
 * Validator History Tracking
 * Stores and compares validator voting power over time
 */

interface ValidatorSnapshot {
  address: string;
  votingPower: string;
  timestamp: number;
}

interface ChainSnapshot {
  chainId: string;
  validators: ValidatorSnapshot[];
  timestamp: number;
}

const STORAGE_KEY_PREFIX = 'validator_history_';
const SNAPSHOT_INTERVAL = 60 * 60 * 1000;
const COMPARISON_INTERVAL = 24 * 60 * 60 * 1000;

/**
 * Save current validator snapshot for a chain
 */
export function saveValidatorSnapshot(
  chainId: string,
  validators: { address: string; votingPower: string }[]
): void {
  try {
    const timestamp = Date.now();
    const snapshot: ChainSnapshot = {
      chainId,
      validators: validators.map(v => ({
        address: v.address,
        votingPower: v.votingPower,
        timestamp,
      })),
      timestamp,
    };

    const key = `${STORAGE_KEY_PREFIX}${chainId}`;
    
    // Get existing snapshots
    const existingData = localStorage.getItem(key);
    const snapshots: ChainSnapshot[] = existingData ? JSON.parse(existingData) : [];
    
    // Add new snapshot
    snapshots.push(snapshot);
    
    // Keep only last 7 days of snapshots
    const sevenDaysAgo = timestamp - (7 * 24 * 60 * 60 * 1000);
    const filteredSnapshots = snapshots.filter(s => s.timestamp > sevenDaysAgo);
    
    localStorage.setItem(key, JSON.stringify(filteredSnapshots));
  } catch (error) {
    console.error('Error saving validator snapshot:', error);
  }
}

/**
 * Get 24h voting power changes for validators
 */
export function get24hChanges(
  chainId: string,
  currentValidators: { address: string; votingPower: string }[]
): Map<string, string> {
  const changes = new Map<string, string>();
  
  try {
    const key = `${STORAGE_KEY_PREFIX}${chainId}`;
    const data = localStorage.getItem(key);
    
    if (!data) {
      return changes;
    }
    
    const snapshots: ChainSnapshot[] = JSON.parse(data);
    if (snapshots.length === 0) {
      return changes;
    }
    
    // Find snapshot from ~24 hours ago (or closest available)
    const now = Date.now();
    const targetTime = now - COMPARISON_INTERVAL;
    
    let closestSnapshot: ChainSnapshot | null = null;
    let minDiff = Infinity;
    
    for (const snapshot of snapshots) {
      const diff = Math.abs(snapshot.timestamp - targetTime);
      if (diff < minDiff && snapshot.timestamp < now) {
        minDiff = diff;
        closestSnapshot = snapshot;
      }
    }
    
    if (!closestSnapshot && snapshots.length > 1) {
      closestSnapshot = snapshots[0];
    }
    
    if (!closestSnapshot) {
      return changes;
    }
    
    const oldPowers = new Map<string, string>();
    for (const val of closestSnapshot.validators) {
      oldPowers.set(val.address, val.votingPower);
    }
    
    for (const current of currentValidators) {
      const oldPower = oldPowers.get(current.address);
      if (oldPower) {
        try {
          const oldVal = BigInt(oldPower);
          const newVal = BigInt(current.votingPower);
          const change = newVal - oldVal;
          if (change !== BigInt(0)) {
            changes.set(current.address, change.toString());
          }
        } catch (e) {
          console.warn(`Error calculating change for ${current.address}:`, e);
        }
      } else {
        if (BigInt(current.votingPower) > BigInt(0)) {
          changes.set(current.address, current.votingPower);
        }
      }
    }
    
    return changes;
  } catch (error) {
    console.error('Error calculating 24h changes:', error);
    return changes;
  }
}

/**
 * Check if we should save a new snapshot (every hour)
 */
export function shouldSaveSnapshot(chainId: string): boolean {
  try {
    const key = `${STORAGE_KEY_PREFIX}${chainId}`;
    const data = localStorage.getItem(key);
    
    if (!data) {
      return true;
    }
    
    const snapshots: ChainSnapshot[] = JSON.parse(data);
    if (snapshots.length === 0) {
      return true;
    }
    
    const latest = snapshots[snapshots.length - 1];
    const timeSinceLastSnapshot = Date.now() - latest.timestamp;
    
    return timeSinceLastSnapshot >= SNAPSHOT_INTERVAL;
  } catch (error) {
    console.error('Error checking snapshot status:', error);
    return false;
  }
}

/**
 * Clear all historical data for a chain
 */
export function clearHistory(chainId: string): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${chainId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing history:', error);
  }
}
