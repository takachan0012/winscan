# Chain Configuration Guidelines

## File Naming Standard

**Format:** `{network}-{type}.json`
- network: lowercase, no spaces (e.g., `tellor`, `lumera`, `bitbadges-1`)
- type: `mainnet` or `test`

**Examples:**
- ✅ `tellor-mainnet.json`
- ✅ `lumera-test.json`
- ✅ `bitbadges-1-mainnet.json`
- ❌ `Tellor.json` (wrong: uppercase, no suffix)
- ❌ `tellor_mainnet.json` (wrong: underscore instead of dash)

## Chain JSON Structure

```json
{
  "chain_name": "tellor-mainnet",           // MUST match filename without .json
  "chain_id": "tellor-mainnet",             // Can be same as chain_name or different
  "pretty_name": "Tellor Mainnet",          // Display name
  "network_type": "mainnet",                // mainnet or testnet
  "bech32_prefix": "tellor",                // Address prefix
  "slip44": 118,
  "fees": {
    "fee_tokens": [{
      "denom": "loya",
      "fixed_min_gas_price": 0.001
    }]
  },
  "staking": {
    "staking_tokens": [{
      "denom": "loya"
    }]
  },
  "rpc": [
    { "address": "https://rpc1.example.com" },
    { "address": "https://rpc2.example.com" }
  ],
  "api": [
    { "address": "https://api1.example.com" },
    { "address": "https://api2.example.com" }
  ]
}
```

## Adding New Chain - Quick Steps

### 1. Create Chain File
Copy template:
```bash
cp Chains/_template.json Chains/yourchain-mainnet.json
```

### 2. Edit Chain Config
Update these fields in `Chains/yourchain-mainnet.json`:
- `chain_name`: "yourchain-mainnet"
- `chain_id`: Get from `curl https://rpc.example.com/status | jq .result.node_info.network`
- `pretty_name`: "Your Chain Mainnet"
- `bech32_prefix`: Get from any wallet address (e.g., "cosmos", "tellor", "osmo")
- `rpc`: List of RPC endpoints
- `api`: List of REST API endpoints
- `fees.fee_tokens[0].denom`: Native token denom
- `staking.staking_tokens[0].denom`: Staking token denom

### 3. Test Chain Config
```bash
# Test RPC endpoint
curl https://your-rpc.com/status

# Test REST API
curl https://your-api.com/cosmos/base/tendermint/v1beta1/node_info

# Test validators endpoint
curl https://your-api.com/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED
```

### 4. Deploy
```bash
# Frontend auto-detects new chain file
git add Chains/yourchain-mainnet.json
git commit -m "Add yourchain-mainnet"
git push origin main

# Backend auto-loads on restart (or wait for auto-reload)
```

## Common Issues

### Issue: "Chain not found" error
**Cause:** Filename doesn't match `chain_name` field
**Fix:** Rename file to match exactly: `{chain_name}.json`

### Issue: Block proposer shows address instead of moniker
**Cause:** Validator consensus pubkey not matching
**Fix:** Verify RPC returns correct proposer_address format (should be hex)

### Issue: Slow loading or timeout
**Cause:** RPC/API endpoints unreliable
**Fix:** Add more fallback endpoints in `rpc` and `api` arrays

### Issue: "No RPC URL configured"
**Cause:** Empty or missing `rpc` array
**Fix:** Add at least one working RPC endpoint

## Chain Name Mapping

Frontend URL → Chain File:
- `/tellor-mainnet/blocks` → `Chains/tellor-mainnet.json`
- `/lumera-test/validators` → `Chains/lumera-test.json`
- `/bitbadges-1/accounts` → `Chains/bitbadges-1.json`

**Rule:** URL path segment MUST match filename (without .json)

## Verification Checklist

Before adding new chain:
- [ ] RPC endpoint responds to `/status`
- [ ] REST API responds to `/cosmos/base/tendermint/v1beta1/node_info`
- [ ] Validators endpoint returns at least 1 validator
- [ ] Filename matches `chain_name` field exactly
- [ ] `chain_name` uses lowercase and dashes only
- [ ] `bech32_prefix` matches actual addresses
- [ ] At least 2 RPC and 2 API endpoints for redundancy
- [ ] Tested locally before pushing to production

## Migration from Old Format

Old format (WRONG):
```
Chains/Tellor.json           → Chains/tellor-mainnet.json
Chains/Lumera.json           → Chains/lumera-mainnet.json
Chains/Emperia-test.json     → Chains/empeiria-test.json
```

Run migration script:
```bash
node scripts/migrate-chains.js
```
