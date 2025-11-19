#!/usr/bin/env node

/**
 * Quick Chain Setup CLI
 * Usage: node scripts/add-chain.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testEndpoint(url, type = 'rpc') {
  return new Promise((resolve) => {
    const testPath = type === 'rpc' ? '/status' : '/cosmos/base/tendermint/v1beta1/node_info';
    const fullUrl = url + testPath;
    
    https.get(fullUrl, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          JSON.parse(data);
          resolve(true);
        } catch {
          resolve(false);
        }
      });
    }).on('error', () => resolve(false));
  });
}

async function main() {
  console.log('\n🚀 WinScan - Quick Chain Setup\n');
  console.log('This wizard will help you add a new blockchain to WinScan.\n');

  // Step 1: Chain Name
  const chainName = await question('1. Chain name (lowercase, e.g., "tellor", "osmosis"): ');
  const networkType = await question('2. Network type (mainnet/test) [mainnet]: ') || 'mainnet';
  const fullChainName = `${chainName}-${networkType}`;

  console.log(`\n✓ Chain will be created as: ${fullChainName}\n`);

  // Step 2: RPC Endpoint
  console.log('3. Testing RPC endpoint...');
  let rpcUrl = await question('   Enter RPC URL (e.g., https://rpc.example.com): ');
  rpcUrl = rpcUrl.replace(/\/$/, ''); // Remove trailing slash
  
  process.stdout.write('   Testing connection... ');
  const rpcWorks = await testEndpoint(rpcUrl, 'rpc');
  console.log(rpcWorks ? '✅ OK' : '❌ FAILED (continuing anyway)');

  // Step 3: API Endpoint
  console.log('\n4. Testing REST API endpoint...');
  let apiUrl = await question('   Enter API URL (e.g., https://api.example.com): ');
  apiUrl = apiUrl.replace(/\/$/, '');
  
  process.stdout.write('   Testing connection... ');
  const apiWorks = await testEndpoint(apiUrl, 'api');
  console.log(apiWorks ? '✅ OK' : '❌ FAILED (continuing anyway)');

  // Step 4: Chain Details
  console.log('\n5. Chain details...');
  const prettyName = await question(`   Display name [${chainName.charAt(0).toUpperCase() + chainName.slice(1)} ${networkType === 'mainnet' ? 'Mainnet' : 'Testnet'}]: `) 
    || `${chainName.charAt(0).toUpperCase() + chainName.slice(1)} ${networkType === 'mainnet' ? 'Mainnet' : 'Testnet'}`;
  
  const bech32Prefix = await question(`   Bech32 prefix (e.g., "cosmos", "tellor") [${chainName}]: `) || chainName;
  const chainId = await question(`   Chain ID (from RPC /status) [${fullChainName}]: `) || fullChainName;
  const denom = await question('   Token denom (e.g., "uatom", "loya") [utoken]: ') || 'utoken';

  // Step 5: Generate Config
  console.log('\n6. Generating configuration...');
  
  const config = {
    chain_name: fullChainName,
    chain_id: chainId,
    pretty_name: prettyName,
    network_type: networkType,
    bech32_prefix: bech32Prefix,
    slip44: 118,
    fees: {
      fee_tokens: [{
        denom: denom,
        fixed_min_gas_price: 0.001,
        low_gas_price: 0.001,
        average_gas_price: 0.0025,
        high_gas_price: 0.004
      }]
    },
    staking: {
      staking_tokens: [{ denom: denom }]
    },
    rpc: [{ address: rpcUrl }],
    api: [{ address: apiUrl }],
    explorers: [{
      kind: "winscan",
      url: `https://winscan.winsnip.xyz/${fullChainName}`
    }]
  };

  // Step 6: Save File
  const chainsDir = path.join(__dirname, '..', 'Chains');
  const filePath = path.join(chainsDir, `${fullChainName}.json`);

  if (fs.existsSync(filePath)) {
    const overwrite = await question(`\n⚠️  File ${fullChainName}.json already exists. Overwrite? (y/N): `);
    if (overwrite.toLowerCase() !== 'y') {
      console.log('\n❌ Cancelled.');
      rl.close();
      return;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  console.log(`\n✅ Created: Chains/${fullChainName}.json`);

  // Step 7: Instructions
  console.log('\n📋 Next Steps:');
  console.log(`   1. Review the config: Chains/${fullChainName}.json`);
  console.log('   2. Add more RPC/API endpoints for redundancy (recommended)');
  console.log('   3. Test locally: npm run dev');
  console.log(`   4. Navigate to: http://localhost:3000/${fullChainName}/blocks`);
  console.log('   5. If working, commit and push:');
  console.log(`      git add Chains/${fullChainName}.json`);
  console.log(`      git commit -m "Add ${prettyName}"`);
  console.log('      git push origin main');
  console.log('\n🎉 Done! Chain configuration ready.\n');

  rl.close();
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  rl.close();
  process.exit(1);
});
