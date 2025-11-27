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
const SNAPSHOT_INTERVAL = 5 * 60 * 1000;
const COMPARISON_INTERVAL = 24 * 60 * 60 * 1000;
const MAX_SNAPSHOTS = 288;

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
    
    // Keep only last 24 hours (288 snapshots at 5-minute intervals)
    if (snapshots.length > MAX_SNAPSHOTS) {
      snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
    }
    
    localStorage.setItem(key, JSON.stringify(snapshots));
  } catch (error) {
    console.error('Error saving validator snapshot:', error);
  }
}

/**
 * Get 24h voting power changes for validators
 * Uses rolling 24-hour window with 5-minute interval snapshots
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
    
    // Find snapshot closest to 24 hours ago
    const now = Date.now();
    const targetTime = now - COMPARISON_INTERVAL;
    
    let oldestSnapshot: ChainSnapshot | null = null;
    
    // If we have snapshots older than 24h, use the one closest to 24h ago
    // Otherwise, use the oldest available snapshot
    for (const snapshot of snapshots) {
      if (snapshot.timestamp <= targetTime) {
        if (!oldestSnapshot || snapshot.timestamp > oldestSnapshot.timestamp) {
          oldestSnapshot = snapshot;
        }
      }
    }
    
    // If no snapshot older than 24h, use the oldest available
    if (!oldestSnapshot && snapshots.length > 0) {
      oldestSnapshot = snapshots[0];
    }
    
    if (!oldestSnapshot) {
      return changes;
    }
    
    // Build map of old voting powers
    const oldPowers = new Map<string, string>();
    for (const val of oldestSnapshot.validators) {
      oldPowers.set(val.address, val.votingPower);
    }
    
    // Calculate changes for each current validator
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
          // Skip if conversion fails
        }
      } else {
        // New validator - show full voting power as increase
        try {
          const power = BigInt(current.votingPower);
          if (power > BigInt(0)) {
            changes.set(current.address, current.votingPower);
          }
        } catch (e) {
          // Skip if conversion fails
        }
      }
    }
    
    return changes;
  } catch (error) {
    return changes;
  }
}

/**
 * Check if we should save a new snapshot (every 5 minutes)
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
    // Silent fail
  }
}
