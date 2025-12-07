import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');

    if (!chain) {
      return NextResponse.json({ error: 'Chain parameter required' }, { status: 400 });
    }

    // Load chain config
    const fs = await import('fs');
    const path = await import('path');
    const chainFilePath = path.join(process.cwd(), 'Chains', `${chain}.json`);
    
    if (!fs.existsSync(chainFilePath)) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    const chainConfig = JSON.parse(fs.readFileSync(chainFilePath, 'utf-8'));
    
    // Get EVM RPC endpoint
    const evmRpc = chainConfig.evm_rpc?.[0]?.address;
    if (!evmRpc) {
      return NextResponse.json({ error: 'Chain does not support EVM' }, { status: 400 });
    }

    // Fetch latest block number
    const blockNumberRes = await fetch(evmRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });

    const blockNumberData = await blockNumberRes.json();
    const latestBlockHex = blockNumberData.result;
    const latestBlock = parseInt(latestBlockHex, 16);

    // Fetch recent blocks and extract transactions
    const transactions: any[] = [];
    const blocksToFetch = 100;

    for (let i = 0; i < blocksToFetch; i++) {
      const blockNum = latestBlock - i;
      const blockHex = '0x' + blockNum.toString(16);

      const blockRes = await fetch(evmRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getBlockByNumber',
          params: [blockHex, true],
          id: 1
        })
      });

      const blockData = await blockRes.json();
      const block = blockData.result;

      if (block && block.transactions && block.transactions.length > 0) {
        for (const tx of block.transactions.slice(0, 10)) { // Take first 10 tx per block
          // Fetch receipt to get actual gasUsed
          let actualGasUsed = '0';
          try {
            const receiptRes = await fetch(evmRpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getTransactionReceipt',
                params: [tx.hash],
                id: 1
              })
            });
            const receiptData = await receiptRes.json();
            if (receiptData.result && receiptData.result.gasUsed) {
              actualGasUsed = parseInt(receiptData.result.gasUsed, 16).toString();
            }
          } catch (e) {
            console.warn('Failed to get receipt for tx:', tx.hash);
          }
          
          transactions.push({
            hash: tx.hash,
            blockNumber: parseInt(tx.blockNumber, 16),
            from: tx.from,
            to: tx.to,
            value: parseInt(tx.value, 16).toString(),
            gasPrice: parseInt(tx.gasPrice, 16).toString(),
            gasUsed: actualGasUsed,
            timestamp: parseInt(block.timestamp, 16)
          });

          if (transactions.length >= 100) break;
        }
      }

      if (transactions.length >= 100) break;
    }

    return NextResponse.json({
      transactions: transactions.slice(0, 100),
      source: 'evm-rpc'
    });

  } catch (error: any) {
    console.error('[EVM Transactions API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch EVM transactions', transactions: [] },
      { status: 500 }
    );
  }
}
