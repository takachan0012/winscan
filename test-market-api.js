// Test manual fetch market data dari ssl.winsnip.xyz

async function testMarketAPI() {
  const baseUrls = [
    'https://ssl.winsnip.xyz',
    'https://ssl2.winsnip.xyz'
  ];
  
  // Test 1: Get all tokens market data
  console.log('=== Test 1: Fetch All PRC20 Market Data ===');
  for (const baseUrl of baseUrls) {
    try {
      const url = `${baseUrl}/api/prc20/market?chain=paxi-mainnet`;
      console.log(`\nTrying: ${url}`);
      
      const response = await fetch(url);
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Success! Got ${Object.keys(data).length} tokens`);
        
        // Show sample data
        const sampleToken = Object.values(data)[0];
        if (sampleToken) {
          console.log('\nSample token data:');
          console.log(JSON.stringify(sampleToken, null, 2));
        }
        
        // Check for COBRA
        const cobra = data['paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u'];
        if (cobra) {
          console.log('\nCOBRA data:');
          console.log(JSON.stringify(cobra, null, 2));
        }
        break;
      } else {
        console.log(`Failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error with ${baseUrl}:`, error.message);
    }
  }
  
  // Test 2: Get specific token market data
  console.log('\n\n=== Test 2: Fetch COBRA Market Data ===');
  const cobraAddress = 'paxi14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9snvcq0u';
  
  for (const baseUrl of baseUrls) {
    try {
      const url = `${baseUrl}/api/prc20/market/${cobraAddress}`;
      console.log(`\nTrying: ${url}`);
      
      const response = await fetch(url);
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Success!');
        console.log(JSON.stringify(data, null, 2));
        break;
      } else {
        console.log(`Failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error with ${baseUrl}:`, error.message);
    }
  }
  
  // Test 3: Check endpoint structure
  console.log('\n\n=== Test 3: Check Available Endpoints ===');
  const testEndpoints = [
    '/api/prc20/market',
    '/api/prc20/prices',
    '/api/prc20/stats',
    '/api/tokens/market',
    '/api/market/prc20'
  ];
  
  for (const endpoint of testEndpoints) {
    try {
      const url = `https://ssl.winsnip.xyz${endpoint}?chain=paxi-mainnet`;
      console.log(`\nTrying: ${url}`);
      
      const response = await fetch(url, { 
        signal: AbortSignal.timeout(3000) 
      });
      
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✓ Endpoint exists!');
        console.log('Response type:', Array.isArray(data) ? 'Array' : 'Object');
        console.log('Sample keys:', Object.keys(data).slice(0, 5));
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('✗ Timeout');
      } else {
        console.log('✗ Not found or error');
      }
    }
  }
}

testMarketAPI().catch(console.error);
