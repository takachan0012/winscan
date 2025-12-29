import { useState } from 'react';

// Helper to encode transaction for broadcast
function makeAminoSignedTx(signedTx: any): Uint8Array {
  // This is a simplified version - in production you'd use proper encoding
  const txString = JSON.stringify(signedTx);
  return new TextEncoder().encode(txString);
}

export interface CascadeUploadResult {
  success: boolean;
  actionId?: string;
  txHash?: string;
  error?: string;
}

export interface CascadeFile {
  id: string;
  name: string;
  size: number;
  type: string;
  public: boolean;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  tx_id: string;
  action_id: string;
  price: number;
  fee: number;
  last_modified: string;
}

export function useCascadeUpload(chainId: string, rpcUrl: string) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const connectKeplr = async () => {
    if (!window.keplr) {
      throw new Error('Please install Keplr extension');
    }

    await window.keplr.enable(chainId);
    const offlineSigner = window.keplr.getOfflineSigner(chainId);
    const accounts = await offlineSigner.getAccounts();
    
    return {
      offlineSigner,
      address: accounts[0].address,
    };
  };

  const uploadFile = async (
    file: File,
    isPublic: boolean = false
  ): Promise<CascadeUploadResult> => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // 1. Connect to Keplr
      setUploadProgress(10);
      if (!window.keplr) {
        throw new Error('Please install Keplr extension');
      }

      await window.keplr.enable(chainId);

      // 2. Get account info
      setUploadProgress(20);
      const key = await window.keplr.getKey(chainId);
      const address = key.bech32Address;

      // 3. Convert file to bytes
      setUploadProgress(30);
      const fileBuffer = await file.arrayBuffer();
      const fileBytes = Array.from(new Uint8Array(fileBuffer));

      // 4. Prepare message - Amino format
      setUploadProgress(40);
      const expirationTime = Math.floor(Date.now() / 1000 + 86400 * 1.5); // 1.5 days
      
      const msg = {
        type: 'lumera/MsgRequestAction',
        value: {
          creator: address,
          action_type: 'ACTION_TYPE_CASCADE',
          data: fileBytes,
          metadata: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            isPublic,
            expirationTime,
          }),
        },
      };

      // 5. Calculate fees
      setUploadProgress(50);
      const storageFee = Math.ceil(file.size / 1024) * 100; // 100 ulume per KB
      const fee = {
        amount: [{ denom: 'ulume', amount: String(storageFee + 7519) }],
        gas: '300000',
      };

      // 6. Get account number and sequence
      setUploadProgress(60);
      const apiUrl = rpcUrl.replace('/rpc', '');
      const accountResponse = await fetch(`${apiUrl}/cosmos/auth/v1beta1/accounts/${address}`);
      const accountData = await accountResponse.json();
      const accountNumber = accountData.account?.account_number || '0';
      const sequence = accountData.account?.sequence || '0';

      // 7. Create sign doc with metadata in memo
      const metadata = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        isPublic,
        expirationTime,
      };
      
      const signDoc = {
        chain_id: chainId,
        account_number: String(accountNumber),
        sequence: String(sequence),
        fee: fee,
        msgs: [msg],
        memo: JSON.stringify(metadata), // Store metadata in memo for easy retrieval
      };

      // 8. Sign with Keplr
      setUploadProgress(70);
      const signedTx = await window.keplr!.signAmino(chainId, address, signDoc, {});

      // 9. Broadcast transaction via Cosmos SDK REST API
      setUploadProgress(80);
      
      // Encode the signed transaction properly for Cosmos SDK
      // The signedTx from Keplr contains: { signed: StdSignDoc, signature: StdSignature }
      const stdTx = {
        msg: signedTx.signed.msgs,
        fee: signedTx.signed.fee,
        signatures: [{
          pub_key: {
            type: 'tendermint/PubKeySecp256k1',
            value: signedTx.signature.pub_key.value,
          },
          signature: signedTx.signature.signature,
        }],
        memo: signedTx.signed.memo,
      };
      
      const broadcastBody = {
        tx: stdTx,
        mode: 'sync', // or 'block' for waiting
      };
      
      const broadcastResponse = await fetch(`${apiUrl}/txs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(broadcastBody),
      });

      if (!broadcastResponse.ok) {
        const errorText = await broadcastResponse.text();
        throw new Error(`Broadcast failed: ${errorText}`);
      }

      const broadcastResult = await broadcastResponse.json();
      
      if (broadcastResult.code !== undefined && broadcastResult.code !== 0) {
        throw new Error(broadcastResult.raw_log || broadcastResult.log || 'Broadcast failed');
      }

      const txHash = broadcastResult.txhash || broadcastResult.hash;

      // 10. Parse action_id from events
      setUploadProgress(90);
      
      // Wait a bit for transaction to be indexed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Query transaction details
      const txResult = await fetch(`${apiUrl}/cosmos/tx/v1beta1/txs/${txHash}`).then(r => r.json());
      
      let actionId: string | undefined;
      
      // Parse from events - check tx_response.events first (as per your example)
      if (txResult.tx_response?.events) {
        const actionRegisteredEvent = txResult.tx_response.events.find(
          (e: any) => e.type === 'action_registered'
        );
        actionId = actionRegisteredEvent?.attributes?.find(
          (attr: any) => attr.key === 'action_id'
        )?.value;
      }

      setUploadProgress(100);
      setUploading(false);

      return {
        success: true,
        actionId,
        txHash,
      };
    } catch (err: any) {
      console.error('Upload error:', err);
      const errorMessage = err.message || 'Upload failed';
      setError(errorMessage);
      setUploading(false);

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  return {
    uploading,
    uploadProgress,
    error,
    uploadFile,
  };
}
