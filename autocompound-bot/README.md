# WinScan Auto-Compound Bot - Validator Setup Guide

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![CosmJS](https://img.shields.io/badge/CosmJS-0.32-purple.svg)](https://github.com/cosmos/cosmjs)
[![PM2](https://img.shields.io/badge/PM2-Ready-2B037A.svg)](https://pm2.keymetrics.io/)

**Supported Chains:**

[![Cosmos Hub](https://img.shields.io/badge/Cosmos_Hub-cosmoshub--4-2E3148.svg)](https://cosmos.network/)
[![Warden](https://img.shields.io/badge/Warden-warden__8765--1-1e2a38.svg)](https://wardenprotocol.org/)
[![Warden Testnet](https://img.shields.io/badge/Warden_Testnet-barra__9191--1-1e2a38.svg)](https://wardenprotocol.org/)
[![Lumera](https://img.shields.io/badge/Lumera-lumera--mainnet--1-812cd6.svg)](https://lumera.io/)
[![Lumera Testnet](https://img.shields.io/badge/Lumera_Testnet-lumera--testnet--2-812cd6.svg)](https://lumera.io/)
[![BitBadges](https://img.shields.io/badge/BitBadges-bitbadges--1-812cd6.svg)](https://bitbadges.io/)

## 🎯 Overview

Run your own auto-compound bot to serve your delegators. **No external API needed** - bot connects directly to blockchain RPC.

## 📋 Requirements

- Node.js 18+
- Your validator operator wallet mnemonic
- Server with 24/7 uptime
- Basic blockchain RPC access

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/winsnip-official/winscan.git
cd winscan/backend-api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Generate Bot Wallet

```bash
# Generate new mnemonic for your bot operator
node
```

In Node.js console:
```javascript
const { DirectSecp256k1HdWallet } = require('@cosmjs/proto-signing');

(async () => {
  const wallet = await DirectSecp256k1HdWallet.generate(12);
  console.log('Bot Mnemonic:', wallet.mnemonic);
  
  // Test on your chain
  const shidoWallet = await DirectSecp256k1HdWallet.fromMnemonic(wallet.mnemonic, { prefix: 'shido' });
  const [account] = await shidoWallet.getAccounts();
  console.log('Shido Address:', account.address);
})();
```

**⚠️ IMPORTANT:** Save this mnemonic securely! This is your bot operator wallet.

### 4. Fund Bot Wallet

Your bot needs gas fees to execute auto-compound transactions.

**Example funding needed:**
- 100 delegators × 1 compound/day = 100 tx/day
- ~0.001 token per tx = ~0.1 token/day
- Fund ~10-50 tokens for safety buffer

**Get addresses for all chains:**
```javascript
const wallet = await DirectSecp256k1HdWallet.fromMnemonic('YOUR_MNEMONIC', { prefix: 'PREFIX' });
```

Replace `PREFIX` with:
- `shido` for Shido
- `osmo` for Osmosis
- `cosmos` for Cosmos Hub
- etc.

### 5. Configure Environment

```bash
cp .env.example .env
nano .env
```

Edit `.env`:
```env
# Server Configuration
PORT=4000
NODE_ENV=production

# Bot Configuration
OPERATOR_MNEMONIC=your twelve word bot mnemonic here
BOT_AUTO_START=true
```

### 6. Register Your Bot

Add your validator to chain registry so delegators can find you:

Edit `Chains/[your-chain].json`:
```json
{
  "chain_id": "shido_9008-1",
  ...
  "autocompound_operators": [
    {
      "moniker": "YourValidatorName",
      "validator_address": "shidovaloper1xxx...your validator address",
      "grantee_address": "shido1xxx...your bot address from step 3",
      "supported": true
    }
  ]
}
```

Submit PR to WinScan repository or contact WinScan team to add your validator.

### 7. Build & Run

```bash
# Build
npm run build

# Run with PM2 (recommended)
npm install -g pm2
pm2 start ecosystem.config.js

# Or run directly
npm start
```

### 8. Verify Bot is Running

```bash
# Check status
curl http://localhost:4000/api/autocompound/status

# Expected response:
{
  "isRunning": true,
  "operatorAddress": "shido1xxx...",
  "tasksCount": 0,
  "tasks": []
}
```

### 9. Load Tasks from Blockchain

Bot will automatically load grants on startup. To manually refresh:

```bash
curl -X POST http://localhost:4000/api/autocompound/load-tasks/shido_9008-1
```

Bot will:
- Query all grants where grantee = your bot address
- Create tasks for each granter
- Execute auto-compound based on frequency settings

## 📊 Monitoring

### View Logs

```bash
# PM2 logs
pm2 logs blockchain-api

# Or check log files
tail -f logs/out.log
tail -f logs/error.log
```

### Expected Log Output

```
🚀 API Server running on port 4000
🤖 Initializing Auto-Compound Bot...
✅ Operator Address: shido1xxx...
✅ Bot initialized successfully
🚀 Bot started automatically
📊 Loading tasks from shido_9008-1...
🔍 Querying grants for operator: shido1xxx...
✅ Found 15 grants on shido_9008-1
➕ Added task: shido_9008-1-shido1abc...-shidovaloper1xxx... (granter: shido1abc..., grantee: shido1xxx...)
➕ Added task: shido_9008-1-shido1def...-shidovaloper1xxx... (granter: shido1def..., grantee: shido1xxx...)
...
✅ Loaded tasks from shido_9008-1

⏰ Processing 15 tasks...
🔄 Executing auto-compound for shido1abc... on shido_9008-1
🔑 Operator address: shido1xxx... (EVM)
💰 Rewards available: 2.145000 shido
📡 Broadcasting auto-compound transaction...
✅ Auto-compound successful!
   TX Hash: A1B2C3D4...
   Height: 24871823
   Gas Used: 171820/600000
```

## 🔧 Configuration

### Adjust Gas Prices

Edit `AutoCompoundBot.ts`:
```typescript
gasPrice: `0.025${chainData.fees?.fee_tokens[0]?.denom}`
```

Change `0.025` to higher/lower based on network conditions.

### Change Check Interval

Edit `AutoCompoundBot.ts`:
```typescript
setInterval(() => {
  this.processAllTasks();
}, 60 * 60 * 1000); // Every hour (default)
```

Change to:
- `30 * 60 * 1000` = 30 minutes
- `2 * 60 * 60 * 1000` = 2 hours

### Minimum Reward Threshold

Edit `AutoCompoundBot.ts`:
```typescript
if (parseFloat(rewards) < 0.01) { // Current: 0.01 tokens
  console.log(`⚠️ Rewards too low, skipping...`);
  return;
}
```

## 🐳 Docker Deployment (Alternative)

```bash
# Build image
docker build -t autocompound-bot .

# Run container
docker run -d \
  --name autocompound-bot \
  -e OPERATOR_MNEMONIC="your mnemonic" \
  -e BOT_AUTO_START=true \
  -p 4000:4000 \
  autocompound-bot
```

## 🔐 Security Best Practices

1. **Secure Mnemonic Storage**
   - Use environment variables (never commit to git)
   - Consider using KMS or hardware wallet for production
   - Restrict file permissions: `chmod 600 .env`

2. **Firewall Configuration**
   ```bash
   # Only allow API access from localhost
   ufw allow from 127.0.0.1 to any port 4000
   ```

3. **Monitor Bot Wallet Balance**
   - Set up alerts for low balance
   - Automate top-up process
   - Track gas fee usage

4. **Backup & Recovery**
   - Store mnemonic in secure location (not on server)
   - Document recovery procedures
   - Test recovery process

## 📈 Business Model

### Free Service
- Attract more delegators to your validator
- Increase staking competitiveness
- Build reputation

### Paid Service
- Charge commission from rewards (e.g., 5%)
- Implement in `AutoCompoundBot.ts`:
  ```typescript
  const commission = parseFloat(rewards) * 0.05;
  const netRewards = parseFloat(rewards) - commission;
  // Delegate netRewards to validator
  // Send commission to your wallet
  ```

### Subscription Model
- Monthly fee per delegator
- Tiered pricing based on frequency
- Premium features (custom schedules, notifications)

## 🆘 Troubleshooting

### Bot not picking up grants

**Check:**
1. Bot operator address matches grantee in grants:
   ```bash
   curl "https://api.shido.com/cosmos/authz/v1beta1/grants/grantee/YOUR_BOT_ADDRESS"
   ```
2. Chain RPC accessible:
   ```bash
   curl "https://rpc.shido.com/status"
   ```
3. Bot logs for errors:
   ```bash
   pm2 logs
   ```

### Transaction failures

**Common errors:**
- `out of gas`: Increase gas limit
- `insufficient funds`: Top up bot wallet
- `authorization not found`: Grant expired or revoked
- `invalid signature`: Check mnemonic/key derivation

### High gas usage

**Solutions:**
- Increase minimum reward threshold
- Adjust compound frequency
- Batch multiple operations (future feature)
- Use cheaper RPC endpoints

## 🤝 Support

- GitHub Issues: https://github.com/winsnip-official/winscan/issues
- Discord: https://discord.gg/winsnip
- Telegram: https://t.me/winsnip

## 📝 API Endpoints (Optional)

If you want to expose bot status to delegators:

```bash
# Get bot status
GET /api/autocompound/status

# Manually trigger compound (for testing)
POST /api/autocompound/execute
{
  "chainId": "shido_9008-1",
  "granter": "shido1abc...",
  "validator": "shidovaloper1xxx..."
}
```

**Security:** Add authentication if exposing publicly.

## 🔄 Updates

Check for updates regularly:
```bash
cd backend-api
git pull
npm install
npm run build
pm2 restart blockchain-api
```

## 📄 License

MIT License - Free to use and modify

---

**Questions?** Open an issue on GitHub or reach out to WinScan team.

**Contributing?** Submit PR to add features or fix bugs!
