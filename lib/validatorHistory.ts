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
const SNAPSHOT_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds (changed from 24h)
const COMPARISON_INTERVAL = 24 * 60 * 60 * 1000; // Compare with 24h ago

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
    
    console.log(`[ValidatorHistory] Saved snapshot for ${chainId} with ${validators.length} validators`);
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
      console.log(`[ValidatorHistory] No historical data for ${chainId}, saving first snapshot`);
      return changes; // No historical data
    }
    
    const snapshots: ChainSnapshot[] = JSON.parse(data);
    if (snapshots.length === 0) {
      return changes;
    }
    
    // Find snapshot from ~24 hours ago (or closest available)
    const now = Date.now();
    const targetTime = now - COMPARISON_INTERVAL;
    
    // Find closest snapshot to 24h ago
    let closestSnapshot: ChainSnapshot | null = null;
    let minDiff = Infinity;
    
    for (const snapshot of snapshots) {
      const diff = Math.abs(snapshot.timestamp - targetTime);
      if (diff < minDiff && snapshot.timestamp < now) {
        minDiff = diff;
        closestSnapshot = snapshot;
      }
    }
    
    // If no snapshot from 24h ago, use the oldest available snapshot
    if (!closestSnapshot && snapshots.length > 1) {
      closestSnapshot = snapshots[0];
      console.log(`[ValidatorHistory] Using oldest snapshot from ${new Date(closestSnapshot.timestamp).toLocaleString()}`);
    }
    
    if (!closestSnapshot) {
      return changes;
    }
    
    const timeDiff = now - closestSnapshot.timestamp;
    const hoursDiff = (timeDiff / (60 * 60 * 1000)).toFixed(1);
    console.log(`[ValidatorHistory] Comparing with snapshot from ${hoursDiff}h ago`);
    
    // Create map of old voting powers
    const oldPowers = new Map<string, string>();
    for (const val of closestSnapshot.validators) {
      oldPowers.set(val.address, val.votingPower);
    }
    
    // Calculate changes
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
        // New validator, treat as full voting power being added
        if (BigInt(current.votingPower) > BigInt(0)) {
          changes.set(current.address, current.votingPower);
        }
      }
    }
    
    console.log(`[ValidatorHistory] Found ${changes.size} validators with changes`);
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
      return true; // No data, save first snapshot
    }
    
    const snapshots: ChainSnapshot[] = JSON.parse(data);
    if (snapshots.length === 0) {
      return true;
    }
    
    // Get latest snapshot
    const latest = snapshots[snapshots.length - 1];
    const timeSinceLastSnapshot = Date.now() - latest.timestamp;
    
    // Save if more than 1 hour since last snapshot
    return timeSinceLastSnapshot >= SNAPSHOT_INTERVAL;
  } catch (error) {
    console.error('Error checking snapshot status:', error);
    return false;
  }
}

/**
 * Force save snapshot immediately (for testing)
 */
export function forceSaveSnapshot(chainId: string, validators: { address: string; votingPower: string }[]): void {
  saveValidatorSnapshot(chainId, validators);
}

/**
 * Clear all historical data for a chain
 */
export function clearHistory(chainId: string): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${chainId}`;
    localStorage.removeItem(key);
    console.log(`[ValidatorHistory] Cleared history for ${chainId}`);
  } catch (error) {
    console.error('Error clearing history:', error);
  }
}
