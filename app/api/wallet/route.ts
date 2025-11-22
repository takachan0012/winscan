import { NextRequest, NextResponse } from 'next/server';
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chain = searchParams.get('chain');
  const address = searchParams.get('address');
  if (!chain || !address) {
    return NextResponse.json(
      { error: 'Missing chain or address parameter' },
      { status: 400 }
    );
  }
  try {
    // Use backend accounts API directly
    const API_URL = process.env.API_URL || 'https://ssl.winsnip.xyz';
    const accountsRes = await fetch(`${API_URL}/api/accounts?chain=${chain}&address=${address}`);
    
    if (!accountsRes.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch account data from backend' },
        { status: accountsRes.status }
      );
    }
    
    const accountData = await accountsRes.json();
    
    // Get validator info if needed
    let validatorsInfo: any = {};
    const validatorAddresses = (accountData.delegations || [])
      .map((del: any) => del.validator)
      .filter(Boolean);
    
    if (validatorAddresses.length > 0) {
      // Get chain info for API URL
      const chainsRes = await fetch(`${request.nextUrl.origin}/api/chains`);
      const chains = await chainsRes.json();
      const selectedChain = chains.find(
        (c: any) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chain.toLowerCase()
      );
      
      if (selectedChain?.api?.[0]?.address) {
        const apiUrl = selectedChain.api[0].address;
        
        try {
          const validatorsRes = await fetch(
            `${apiUrl}/cosmos/staking/v1beta1/validators?pagination.limit=500&status=BOND_STATUS_BONDED`
          );
          const validatorsData = await validatorsRes.json();
          (validatorsData.validators || []).forEach((val: any) => {
            validatorsInfo[val.operator_address] = {
              moniker: val.description?.moniker || 'Unknown',
              identity: val.description?.identity || '',
              operatorAddress: val.operator_address,
            };
          });
        } catch (err) {
        }
        
        const missingValidators = validatorAddresses.filter(
          (addr: string) => !validatorsInfo[addr]
        );
        if (missingValidators.length > 0) {
          const individualFetches = missingValidators.map(async (valAddr: string) => {
            try {
              const valRes = await fetch(
                `${apiUrl}/cosmos/staking/v1beta1/validators/${valAddr}`
              );
              const valData = await valRes.json();
              if (valData.validator) {
                validatorsInfo[valAddr] = {
                  moniker: valData.validator.description?.moniker || 'Unknown',
                  identity: valData.validator.description?.identity || '',
                  operatorAddress: valAddr,
                };
              }
            } catch (err) {
              validatorsInfo[valAddr] = {
                moniker: 'Unknown',
                identity: '',
                operatorAddress: valAddr,
              };
            }
          });
          await Promise.all(individualFetches);
        }
      }
    }
    
    // Enrich delegations with validator info
    const delegations = (accountData.delegations || []).map((del: any) => ({
      ...del,
      validatorInfo: validatorsInfo[del.validator] || null,
    }));
    
    // Format response to match expected frontend structure
    return NextResponse.json({
      address: accountData.address,
      isValidator: accountData.isValidator || false,
      validatorAddress: accountData.validatorAddress || null,
      balances: accountData.balances || [],
      delegations,
      rewards: accountData.rewards || [],
      totalRewards: accountData.totalRewards || [],
      unbonding: accountData.unbonding || [],
      commission: accountData.commission || null,
      transactions: (accountData.transactions || []).map((tx: any) => ({
        hash: tx.hash,
        height: tx.height || '0',
        time: tx.time || new Date().toISOString(),
        type: tx.type || 'Transaction',
        result: tx.result || 'Success',
        code: tx.code || 0,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        error: 'Failed to fetch wallet data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
