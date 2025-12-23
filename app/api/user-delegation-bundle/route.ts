import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const LCD_ENDPOINTS: Record<string, string[]> = {
  'paxi-mainnet': [
    'https://mainnet-lcd.paxinet.io',
    'https://api-paxi.winnode.xyz',
    'https://api-paxi-m.maouam.xyz'
  ],
  'cosmoshub-mainnet': [
    'https://lcd-cosmoshub.keplr.app',
    'https://api-cosmoshub-ia.cosmosia.notional.ventures'
  ],
  'osmosis-mainnet': [
    'https://lcd-osmosis.keplr.app',
    'https://api-osmosis-ia.cosmosia.notional.ventures'
  ]
};

/**
 * Bundle user delegation data for a specific validator
 * Returns: balance, staked amount, rewards, commission in one call
 * Replaces 4+ sequential API calls
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chain, validatorAddress, delegatorAddress, denom } = body;

    if (!chain || !validatorAddress || !delegatorAddress || !denom) {
      return NextResponse.json(
        { error: 'chain, validatorAddress, delegatorAddress, and denom required' },
        { status: 400 }
      );
    }

    const endpoints = LCD_ENDPOINTS[chain] || LCD_ENDPOINTS['paxi-mainnet'];
    const lcdUrl = endpoints[0];
    
    console.log(`[User Delegation Bundle] Fetching data for ${delegatorAddress} on ${chain}`);
    
    // Parallel fetch all data
    const [balanceRes, delegationsRes, rewardsRes, commissionRes] = await Promise.allSettled([
      // Balance
      fetch(`${lcdUrl}/cosmos/bank/v1beta1/balances/${delegatorAddress}/${denom}`, {
        signal: AbortSignal.timeout(5000)
      }),
      
      // All delegations (to find specific validator delegation)
      fetch(`${lcdUrl}/cosmos/staking/v1beta1/delegations/${delegatorAddress}`, {
        signal: AbortSignal.timeout(5000)
      }),
      
      // Rewards from specific validator
      fetch(`${lcdUrl}/cosmos/distribution/v1beta1/delegators/${delegatorAddress}/rewards/${validatorAddress}`, {
        signal: AbortSignal.timeout(5000)
      }),
      
      // Validator commission (if user is the validator)
      fetch(`${lcdUrl}/cosmos/distribution/v1beta1/validators/${validatorAddress}/commission`, {
        signal: AbortSignal.timeout(5000)
      })
    ]);

    // Parse balance
    let balance = '0';
    if (balanceRes.status === 'fulfilled' && balanceRes.value.ok) {
      const data = await balanceRes.value.json();
      balance = data.balance?.amount || '0';
    }

    // Parse delegation (find specific validator)
    let stakedAmount = '0';
    if (delegationsRes.status === 'fulfilled' && delegationsRes.value.ok) {
      const data = await delegationsRes.value.json();
      const delegation = data.delegation_responses?.find(
        (d: any) => d.delegation?.validator_address === validatorAddress
      );
      stakedAmount = delegation?.balance?.amount || '0';
    }

    // Parse rewards
    let rewards = '0';
    if (rewardsRes.status === 'fulfilled' && rewardsRes.value.ok) {
      const data = await rewardsRes.value.json();
      const mainReward = data.rewards?.find((r: any) => r.denom === denom);
      rewards = mainReward?.amount || '0';
    }

    // Parse commission
    let commission = '0';
    if (commissionRes.status === 'fulfilled' && commissionRes.value.ok) {
      const data = await commissionRes.value.json();
      const commissionList = data.commission?.commission || data.commission || [];
      const mainCommission = commissionList.find((c: any) => c.denom === denom);
      commission = mainCommission?.amount || '0';
    }

    console.log(`[User Delegation Bundle] ✅ Complete for ${delegatorAddress}`);
    
    return NextResponse.json({
      delegator: delegatorAddress,
      validator: validatorAddress,
      balance,
      stakedAmount,
      rewards,
      commission
    });

  } catch (error) {
    console.error('User delegation bundle error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch delegation data' },
      { status: 500 }
    );
  }
}
