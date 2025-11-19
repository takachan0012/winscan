import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface ChainData {
  chain_name: string;
  chain_id?: string;
  api?: Array<{ address: string; provider?: string }>;
}

// Load chains data from JSON files
function loadChainsData(): ChainData[] {
  const chainsDir = path.join(process.cwd(), 'Chains');
  const files = fs.readdirSync(chainsDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  return files.map(file => {
    const content = fs.readFileSync(path.join(chainsDir, file), 'utf-8');
    return JSON.parse(content);
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chainParam = searchParams.get('chain');

  if (!chainParam) {
    return NextResponse.json({ error: 'Chain parameter required' }, { status: 400 });
  }

  try {
    // Find chain config
    const chainsData = loadChainsData();
    const chain = chainsData.find((c: ChainData) => 
      c.chain_name === chainParam || 
      c.chain_id === chainParam ||
      c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainParam.toLowerCase()
    );

    if (!chain) {
      return NextResponse.json({ error: 'Chain not found' }, { status: 404 });
    }

    const lcdEndpoints = chain.api || [];
    if (lcdEndpoints.length === 0) {
      return NextResponse.json({ error: 'No LCD endpoints available' }, { status: 500 });
    }

    // Fetch validators from LCD
    let allValidators: any[] = [];
    
    for (const endpoint of lcdEndpoints) {
      try {
        // Fetch bonded validators
        const bondedUrl = `${endpoint.address}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=300`;
        const bondedRes = await fetch(bondedUrl, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000),
        });

        if (bondedRes.ok) {
          const bondedData = await bondedRes.json();
          allValidators = bondedData.validators || [];

          // Try to fetch unbonded/unbonding too
          try {
            const [unbonding, unbonded] = await Promise.allSettled([
              fetch(`${endpoint.address}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_UNBONDING&pagination.limit=300`, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000),
              }).then(r => r.ok ? r.json() : { validators: [] }),
              fetch(`${endpoint.address}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_UNBONDED&pagination.limit=300`, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000),
              }).then(r => r.ok ? r.json() : { validators: [] })
            ]);

            if (unbonding.status === 'fulfilled') {
              allValidators = [...allValidators, ...(unbonding.value.validators || [])];
            }
            if (unbonded.status === 'fulfilled') {
              allValidators = [...allValidators, ...(unbonded.value.validators || [])];
            }
          } catch {
            // Silent fail for unbonded/unbonding
          }

          break; // Success, stop trying other endpoints
        }
      } catch (error) {
        continue; // Try next endpoint
      }
    }

    if (allValidators.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch validators' }, { status: 500 });
    }

    // Transform validators with enhanced data
    const enhancedValidators = await Promise.all(
      allValidators.map(async (v: any) => {
        const validator = {
          address: v.operator_address,
          moniker: v.description?.moniker || 'Unknown',
          identity: v.description?.identity,
          website: v.description?.website,
          details: v.description?.details,
          status: v.status,
          jailed: v.jailed,
          votingPower: v.tokens || '0',
          commission: v.commission?.commission_rates?.rate || '0',
          consensus_pubkey: v.consensus_pubkey,
          delegatorsCount: 0,
          uptime: 100,
        };

        // Fetch delegators count in parallel (non-blocking)
        try {
          for (const endpoint of lcdEndpoints) {
            try {
              const delegatorsUrl = `${endpoint.address}/cosmos/staking/v1beta1/validators/${v.operator_address}/delegations?pagination.limit=1&pagination.count_total=true`;
              const delegatorsRes = await fetch(delegatorsUrl, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(3000),
              });
              
              if (delegatorsRes.ok) {
                const delegatorsData = await delegatorsRes.json();
                validator.delegatorsCount = parseInt(delegatorsData.pagination?.total || '0');
                break;
              }
            } catch {
              continue;
            }
          }
        } catch {
          // Silent fail
        }

        return validator;
      })
    );

    // Sort by voting power
    enhancedValidators.sort((a, b) => {
      const tokensA = BigInt(a.votingPower);
      const tokensB = BigInt(b.votingPower);
      return tokensB > tokensA ? 1 : tokensB < tokensA ? -1 : 0;
    });

    return NextResponse.json({
      validators: enhancedValidators,
      total: enhancedValidators.length,
    });

  } catch (error) {
    console.error('[API] Validators fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
