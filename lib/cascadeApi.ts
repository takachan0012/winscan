import { CascadeFile } from '@/hooks/useCascadeUpload';

const API_BASE = 'https://ssl.winsnip.xyz/api/cascade';

export interface SuperNode {
  address: string;
  supernode_account: string;
  moniker: string;
  version?: string;
  status: 'online' | 'offline';
  location: {
    city: string;
    country: string;
    lat: number;
    lng: number;
  };
  storage_used: number;
  storage_total: number;
  bandwidth: number;
  uptime: number;
}

export interface FetchFilesResponse {
  success: boolean;
  files: CascadeFile[];
}

export interface FetchSupernodesResponse {
  success: boolean;
  supernodes: SuperNode[];
}

/**
 * Fetch user's uploaded files from backend
 */
export async function fetchUserFiles(
  chain: string,
  address: string
): Promise<CascadeFile[]> {
  try {
    const response = await fetch(
      `${API_BASE}/files?chain=${chain}&address=${address}`
    );
    const data: FetchFilesResponse = await response.json();

    if (data.success && data.files) {
      return data.files;
    }
    return [];
  } catch (error) {
    console.error('Error fetching user files:', error);
    return [];
  }
}

/**
 * Fetch supernodes from backend
 */
export async function fetchSupernodes(chain: string): Promise<SuperNode[]> {
  try {
    const response = await fetch(`${API_BASE}/supernodes?chain=${chain}`);
    const data: FetchSupernodesResponse = await response.json();

    if (data.success && data.supernodes) {
      return data.supernodes;
    }
    return [];
  } catch (error) {
    console.error('Error fetching supernodes:', error);
    return [];
  }
}

/**
 * Parse transaction events to extract file info
 */
export function parseUploadTransaction(txEvents: any[]): {
  actionId: string;
  creator: string;
  actionType: string;
  fee: string;
  storageFee: string;
} | null {
  try {
    const actionEvent = txEvents.find((e) => e.type === 'action_registered');
    if (!actionEvent) return null;

    const getAttr = (key: string) =>
      actionEvent.attributes.find((a: any) => a.key === key)?.value;

    const txEvent = txEvents.find((e) => e.type === 'tx');
    const txFee = txEvent?.attributes.find((a: any) => a.key === 'fee')?.value;

    return {
      actionId: getAttr('action_id') || '',
      creator: getAttr('creator') || '',
      actionType: getAttr('action_type') || '',
      fee: txFee || '0ulume',
      storageFee: getAttr('fee') || '0ulume',
    };
  } catch (error) {
    console.error('Error parsing transaction:', error);
    return null;
  }
}

/**
 * Download file from Cascade network
 */
export async function downloadCascadeFile(
  actionId: string,
  fileName: string
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE}/download?action_id=${actionId}`
    );
    
    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
    throw error;
  }
}
