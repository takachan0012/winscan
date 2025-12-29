import { CascadeFile } from '@/hooks/useCascadeUpload';

interface TxEvent {
  type: string;
  attributes: Array<{
    key: string;
    value: string;
    index?: boolean;
  }>;
}

interface Transaction {
  hash: string;
  height: string;
  tx: {
    body: {
      messages: any[];
      memo?: string;
    };
  };
  tx_response?: {
    events?: TxEvent[];
    timestamp?: string;
  };
}

/**
 * Parse CASCADE action from transaction events
 */
export function parseCascadeAction(events: TxEvent[]): {
  actionId: string;
  creator: string;
  actionType: string;
  fee: string;
  storageFee: string;
} | null {
  try {
    const actionEvent = events.find((e) => e.type === 'action_registered');
    if (!actionEvent) return null;

    const getAttr = (key: string) =>
      actionEvent.attributes.find((a) => a.key === key)?.value || '';

    // Get transaction fee from tx event
    const txEvent = events.find((e) => e.type === 'tx');
    const txFee = txEvent?.attributes.find((a) => a.key === 'fee')?.value || '0ulume';

    // Get storage fee from coin_spent event with msg_index
    const coinSpentEvents = events.filter((e) => e.type === 'coin_spent');
    const storageFeeEvent = coinSpentEvents.find((e) =>
      e.attributes.some((a) => a.key === 'msg_index' && a.value === '0')
    );
    const storageFee = storageFeeEvent?.attributes.find((a) => a.key === 'amount')?.value || '0ulume';

    return {
      actionId: getAttr('action_id'),
      creator: getAttr('creator'),
      actionType: getAttr('action_type'),
      fee: txFee,
      storageFee: storageFee,
    };
  } catch (error) {
    console.error('Error parsing cascade action:', error);
    return null;
  }
}

/**
 * Extract file metadata from transaction message
 */
export function extractFileMetadata(tx: Transaction): {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  isPublic?: boolean;
} {
  try {
    const msg = tx.tx.body.messages[0];
    
    // Try different possible metadata locations
    let metadataStr = null;
    
    // Check if metadata is in msg.metadata
    if (msg?.metadata) {
      metadataStr = msg.metadata;
    }
    
    // Check if metadata is in msg.value.metadata (Amino format)
    if (!metadataStr && msg?.value?.metadata) {
      metadataStr = msg.value.metadata;
    }
    
    // Check if metadata is in tx memo
    if (!metadataStr && tx.tx.body.memo) {
      try {
        const memoData = JSON.parse(tx.tx.body.memo);
        if (memoData.fileName) {
          return {
            fileName: memoData.fileName,
            fileSize: memoData.fileSize,
            fileType: memoData.fileType,
            isPublic: memoData.isPublic,
          };
        }
      } catch {
        // Not JSON memo, ignore
      }
    }
    
    if (metadataStr) {
      const metadata = typeof metadataStr === 'string' 
        ? JSON.parse(metadataStr) 
        : metadataStr;
        
      return {
        fileName: metadata.fileName,
        fileSize: metadata.fileSize,
        fileType: metadata.fileType,
        isPublic: metadata.isPublic,
      };
    }
    
    return {};
  } catch (error) {
    console.error('Error extracting file metadata:', error);
    return {};
  }
}

/**
 * Convert transaction to CascadeFile
 */
export function txToCascadeFile(tx: Transaction): CascadeFile | null {
  try {
    const events = tx.tx_response?.events || [];
    const action = parseCascadeAction(events);
    
    if (!action || action.actionType !== 'ACTION_TYPE_CASCADE') {
      return null;
    }

    const metadata = extractFileMetadata(tx);
    const timestamp = tx.tx_response?.timestamp || new Date().toISOString();

    // Parse fee amount (remove 'ulume' suffix)
    const feeAmount = parseInt(action.storageFee.replace('ulume', '')) || 0;

    return {
      id: action.actionId,
      name: metadata.fileName || 'Unknown File',
      size: metadata.fileSize || 0,
      type: metadata.fileType || 'unknown',
      public: metadata.isPublic || false,
      status: 'completed',
      tx_id: tx.hash,
      action_id: action.actionId,
      price: 0,
      fee: feeAmount,
      last_modified: timestamp,
    };
  } catch (error) {
    console.error('Error converting tx to cascade file:', error);
    return null;
  }
}

/**
 * Fetch user's CASCADE transactions from blockchain
 */
export async function fetchUserCascadeTransactions(
  apiUrl: string,
  address: string
): Promise<CascadeFile[]> {
  try {
    // Fetch transactions where sender is the user
    const response = await fetch(
      `${apiUrl}/cosmos/tx/v1beta1/txs?events=message.sender='${address}'&events=message.action='/lumera.action.v1.MsgRequestAction'&pagination.limit=100&order_by=ORDER_BY_DESC`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.statusText}`);
    }

    const data = await response.json();
    const transactions: Transaction[] = data.txs || [];

    // Parse and filter CASCADE transactions
    const files: CascadeFile[] = [];
    for (const tx of transactions) {
      const file = txToCascadeFile(tx);
      if (file) {
        files.push(file);
      }
    }

    return files;
  } catch (error) {
    console.error('Error fetching user cascade transactions:', error);
    return [];
  }
}
