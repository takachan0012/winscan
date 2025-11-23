import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const chain = searchParams.get('chain');
    const address = searchParams.get('address');
    const limit = searchParams.get('limit') || '100';
    const offset = searchParams.get('offset') || '0';

    if (!chain) {
      return NextResponse.json({ error: 'Chain parameter required' }, { status: 400 });
    }

    if (address) {
      try {
        const backendUrl = `${API_URL}/api/accounts?chain=${chain}&address=${address}&limit=100&tx_limit=100&txLimit=100`;
        console.log('[Accounts API] Trying backend with address query:', backendUrl);
        
        const backendResponse = await fetch(backendUrl, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 30 }
        });
        
        if (backendResponse.ok) {
          const backendData = await backendResponse.json();
          console.log('[Accounts API] Backend success, transactions:', backendData.transactions?.length || 0, 'Total in response:', JSON.stringify(backendData).includes('total') ? 'has total field' : 'no total');
          
          if (backendData.delegations && backendData.delegations.length > 0) {
            const chainsResponse = await fetch(`${API_URL}/api/chains`, {
              headers: { 'Accept': 'application/json' },
              next: { revalidate: 300 }
            });
            
            if (chainsResponse.ok) {
              const chains = await chainsResponse.json();
              const chainConfig = chains.find((c: any) => 
                c.chain_id === chain || 
                c.chain_name === chain ||
                c.chain_name.toLowerCase().replace(/\s+/g, '-') === chain.toLowerCase()
              );
              
              if (chainConfig?.api?.[0]?.address) {
                const apiBase = chainConfig.api[0].address.replace(/\/$/, '');
                
                const delegationsWithInfo = await Promise.all(
                  backendData.delegations.map(async (del: any) => {
                    try {
                      const valAddr = del.validator || del.delegation?.validator_address || '';
                      if (!valAddr) return del;
                      
                      const validatorUrl = `${apiBase}/cosmos/staking/v1beta1/validators/${valAddr}`;
                      const valRes = await fetch(validatorUrl, { 
                        signal: AbortSignal.timeout(5000),
                        headers: { 'Accept': 'application/json' }
                      });
                      
                      if (valRes.ok) {
                        const valData = await valRes.json();
                        return {
                          ...del,
                          validatorInfo: {
                            moniker: valData.validator?.description?.moniker || '',
                            identity: valData.validator?.description?.identity || '',
                            operatorAddress: valAddr,
                            jailed: valData.validator?.jailed || false
                          }
                        };
                      }
                      return del;
                    } catch (err) {
                      return del;
                    }
                  })
                );
                
                backendData.delegations = delegationsWithInfo;
              }
            }
          }
          
          return NextResponse.json(backendData, {
            headers: {
              'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
            }
          });
        }
        
        console.log('[Accounts API] Backend failed, falling back to direct RPC query');
        
        const chainsResponse = await fetch(`${API_URL}/api/chains`, {
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 300 }
        });
        
        if (!chainsResponse.ok) {
          throw new Error('Failed to fetch chain config');
        }
        
        const chains = await chainsResponse.json();
        const chainConfig = chains.find((c: any) => 
          c.chain_id === chain || 
          c.chain_name === chain ||
          c.chain_name.toLowerCase().replace(/\s+/g, '-') === chain.toLowerCase()
        );
        
        if (!chainConfig || !chainConfig.api || chainConfig.api.length === 0) {
          throw new Error('Chain configuration not found or no API endpoints available');
        }

        let lastError = null;
        for (const apiEndpoint of chainConfig.api) {
          try {
            const apiBase = apiEndpoint.address.replace(/\/$/, '');
            
            const balancesUrl = `${apiBase}/cosmos/bank/v1beta1/balances/${address}`;
            const balancesRes = await fetch(balancesUrl, { 
              signal: AbortSignal.timeout(10000),
              headers: { 'Accept': 'application/json' }
            });
            
            if (!balancesRes.ok) continue;
            const balancesData = await balancesRes.json();
            
            const delegationsUrl = `${apiBase}/cosmos/staking/v1beta1/delegations/${address}`;
            const delegationsRes = await fetch(delegationsUrl, { 
              signal: AbortSignal.timeout(10000),
              headers: { 'Accept': 'application/json' }
            });
            
            const delegationsData = delegationsRes.ok ? await delegationsRes.json() : { delegation_responses: [] };
            
            const delegationsWithInfo = await Promise.all(
              (delegationsData.delegation_responses || []).map(async (del: any) => {
                try {
                  const valAddr = del.delegation?.validator_address || '';
                  if (!valAddr) return del;
                  
                  const validatorUrl = `${apiBase}/cosmos/staking/v1beta1/validators/${valAddr}`;
                  const valRes = await fetch(validatorUrl, { 
                    signal: AbortSignal.timeout(5000),
                    headers: { 'Accept': 'application/json' }
                  });
                  
                  if (valRes.ok) {
                    const valData = await valRes.json();
                    return {
                      ...del,
                      validatorInfo: {
                        moniker: valData.validator?.description?.moniker || '',
                        identity: valData.validator?.description?.identity || '',
                        operatorAddress: valAddr,
                        jailed: valData.validator?.jailed || false
                      }
                    };
                  }
                  return del;
                } catch (err) {
                  return del;
                }
              })
            );
            
            const rewardsUrl = `${apiBase}/cosmos/distribution/v1beta1/delegators/${address}/rewards`;
            const rewardsRes = await fetch(rewardsUrl, { 
              signal: AbortSignal.timeout(10000),
              headers: { 'Accept': 'application/json' }
            });
            
            const rewardsData = rewardsRes.ok ? await rewardsRes.json() : { rewards: [] };
            
            let transactions: any[] = [];
            try {
              const rpcEndpoint = chainConfig.rpc?.find((r: any) => r.tx_index === 'on') || chainConfig.rpc?.[0];
              if (rpcEndpoint) {
                const rpcBase = rpcEndpoint.address.replace(/\/$/, '');
                
                const queries = [
                  `message.sender='${address}'`,
                  `transfer.sender='${address}'`,
                  `transfer.recipient='${address}'`
                ];
                
                const txSets: any[] = [];
                
                for (const query of queries) {
                  try {
                    const txSearchUrl = `${rpcBase}/tx_search?query="${query}"&order_by="desc"&per_page=10`;
                    const txRes = await fetch(txSearchUrl, {
                      signal: AbortSignal.timeout(5000),
                      headers: { 'Accept': 'application/json' }
                    });
                    
                    if (txRes.ok) {
                      const txData = await txRes.json();
                      if (txData.result?.txs && Array.isArray(txData.result.txs)) {
                        txSets.push(...txData.result.txs);
                      }
                    }
                  } catch (e) {
                  }
                }
                
                const uniqueTxs = Array.from(new Map(txSets.map(tx => [tx.hash, tx])).values());
                
                transactions = uniqueTxs.slice(0, 20).map((tx: any) => {
                  const txResult = tx.tx_result || {};
                  const timestamp = tx.timestamp || new Date().toISOString();
                  
                  let msgType = 'Unknown';
                  try {
                    if (txResult.events) {
                      const msgEvent = txResult.events.find((e: any) => e.type === 'message');
                      if (msgEvent) {
                        const actionAttr = msgEvent.attributes?.find((a: any) => 
                          (typeof a.key === 'string' ? a.key : atob(a.key || '')) === 'action'
                        );
                        if (actionAttr) {
                          const action = typeof actionAttr.value === 'string' ? actionAttr.value : atob(actionAttr.value || '');
                          msgType = action || msgType;
                        }
                      }
                    }
                  } catch (e) {
                    console.error('Error parsing tx events:', e);
                  }
                  
                  return {
                    hash: tx.hash || '',
                    height: parseInt(tx.height) || 0,
                    type: msgType,
                    result: (txResult.code === 0 || txResult.code === undefined) ? 'Success' : 'Failed',
                    time: timestamp,
                    fee: txResult.gas_used ? `${txResult.gas_used} gas` : ''
                  };
                });
              }
            } catch (txErr) {
              console.error('[Accounts API] Failed to fetch transactions:', txErr);
            }
            
            const accountData = {
              address,
              balances: balancesData.balances || [],
              delegations: delegationsWithInfo,
              rewards: rewardsData.rewards || [],
              transactions
            };
            
            return NextResponse.json(accountData, {
              headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60'
              }
            });
            
          } catch (err: any) {
            lastError = err;
            console.error(`[Accounts API] Failed with endpoint ${apiEndpoint.address}:`, err.message);
            continue;
          }
        }
        
        throw lastError || new Error('All API endpoints failed');
        
      } catch (error: any) {
        console.error('[Accounts API] Error fetching account detail:', error.message);
        return NextResponse.json(
          { error: 'Failed to fetch account details', details: error.message },
          { status: 500 }
        );
      }
    }

    const backendUrl = `${API_URL}/api/accounts?chain=${chain}&limit=${limit}&offset=${offset}`;
    console.log('[Accounts API] Fetching accounts list from backend:', backendUrl);
    
    const response = await fetch(backendUrl, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      console.error('[Accounts API] Backend error:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });

  } catch (error: any) {
    console.error('[Accounts API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
