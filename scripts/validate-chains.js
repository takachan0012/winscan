#!/usr/bin/env node

/**
 * Chain Configuration Validator
 * Checks all chain configs for common issues
 */

const fs = require('fs');
const path = require('path');

const chainsDir = path.join(__dirname, '..', 'Chains');
const files = fs.readdirSync(chainsDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));

console.log('\n🔍 Validating Chain Configurations\n');

let errors = 0;
let warnings = 0;

files.forEach(file => {
  const filePath = path.join(chainsDir, file);
  const chainName = file.replace('.json', '');
  
  console.log(`\n📄 ${file}`);
  
  try {
    const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Rule 1: chain_name must match filename
    if (config.chain_name !== chainName) {
      console.log(`   ❌ ERROR: chain_name "${config.chain_name}" doesn't match filename "${chainName}"`);
      errors++;
    } else {
      console.log(`   ✅ chain_name matches filename`);
    }
    
    // Rule 2: Must have RPC endpoints
    if (!config.rpc || config.rpc.length === 0) {
      console.log(`   ❌ ERROR: No RPC endpoints configured`);
      errors++;
    } else {
      console.log(`   ✅ ${config.rpc.length} RPC endpoint(s)`);
      if (config.rpc.length < 2) {
        console.log(`   ⚠️  WARNING: Only 1 RPC endpoint (recommend at least 2 for redundancy)`);
        warnings++;
      }
    }
    
    // Rule 3: Must have API endpoints
    if (!config.api || config.api.length === 0) {
      console.log(`   ❌ ERROR: No API endpoints configured`);
      errors++;
    } else {
      console.log(`   ✅ ${config.api.length} API endpoint(s)`);
      if (config.api.length < 2) {
        console.log(`   ⚠️  WARNING: Only 1 API endpoint (recommend at least 2 for redundancy)`);
        warnings++;
      }
    }
    
    // Rule 4: Must have bech32_prefix
    if (!config.bech32_prefix) {
      console.log(`   ❌ ERROR: Missing bech32_prefix`);
      errors++;
    } else {
      console.log(`   ✅ bech32_prefix: ${config.bech32_prefix}`);
    }
    
    // Rule 5: Must have chain_id
    if (!config.chain_id) {
      console.log(`   ❌ ERROR: Missing chain_id`);
      errors++;
    } else {
      console.log(`   ✅ chain_id: ${config.chain_id}`);
    }
    
    // Rule 6: Check naming convention
    if (!/^[a-z0-9]+-(?:mainnet|test)$/.test(chainName)) {
      console.log(`   ⚠️  WARNING: Filename doesn't follow naming convention (lowercase-mainnet or lowercase-test)`);
      warnings++;
    } else {
      console.log(`   ✅ Filename follows naming convention`);
    }
    
    // Rule 7: Must have fee tokens
    if (!config.fees?.fee_tokens || config.fees.fee_tokens.length === 0) {
      console.log(`   ⚠️  WARNING: No fee tokens configured`);
      warnings++;
    } else {
      console.log(`   ✅ Fee token: ${config.fees.fee_tokens[0].denom}`);
    }
    
    // Rule 8: Must have staking tokens
    if (!config.staking?.staking_tokens || config.staking.staking_tokens.length === 0) {
      console.log(`   ⚠️  WARNING: No staking tokens configured`);
      warnings++;
    } else {
      console.log(`   ✅ Staking token: ${config.staking.staking_tokens[0].denom}`);
    }
    
  } catch (err) {
    console.log(`   ❌ ERROR: Invalid JSON - ${err.message}`);
    errors++;
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Summary: ${files.length} chains validated`);
console.log(`   ${errors === 0 ? '✅' : '❌'} Errors: ${errors}`);
console.log(`   ${warnings === 0 ? '✅' : '⚠️ '} Warnings: ${warnings}`);

if (errors > 0) {
  console.log('\n❌ Validation FAILED. Please fix errors above.\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n⚠️  Validation PASSED with warnings. Consider addressing them.\n');
  process.exit(0);
} else {
  console.log('\n✅ All chains validated successfully!\n');
  process.exit(0);
}
