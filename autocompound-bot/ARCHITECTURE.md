# WinScan Auto-Compound Bot

Backend bot operator untuk menjalankan auto-compound secara otomatis menggunakan Cosmos authz grants.

## 🎯 Target Audience

**For Validators**: Run your own bot to serve your delegators. See [VALIDATOR-SETUP.md](./VALIDATOR-SETUP.md) for detailed setup guide.

**For WinScan Team**: Reference implementation and API documentation.

## 🏗️ Architecture

```
┌─────────────────┐
│   Delegator     │
│   (User)        │
└────────┬────────┘
         │ 1. Enable Auto-Compound
         │    (Sign MsgGrant)
         ▼
┌─────────────────┐
│   Blockchain    │◄──────┐
│   (Cosmos SDK)  │       │
└────────┬────────┘       │
         │                │
         │ 2. Query       │ 4. Execute
         │    Grants      │    MsgExec
         │                │
         ▼                │
┌─────────────────────────┴──┐
│   Validator's Bot          │
│   (AutoCompoundBot)        │
│                            │
│   - Monitor grants         │
│   - Check rewards          │
│   - Compound automatically │
└────────────────────────────┘
```

**Key Points:**
- ✅ **No centralized API** - Bot connects directly to blockchain RPC
- ✅ **Validator-operated** - Each validator runs their own bot
- ✅ **User-controlled** - Users can revoke grants anytime
- ✅ **Decentralized** - No single point of failure

## 🚀 Features

- ✅ Monitoring authz grants dari blockchain
- ✅ Auto-compound rewards based on frequency (hourly/daily/weekly/monthly)
- ✅ Multi-chain support
- ✅ Automatic task scheduling
- ✅ Manual trigger via API
- ✅ Real-time status monitoring

## 🚀 Quick Start

### For Validators

See [VALIDATOR-SETUP.md](./VALIDATOR-SETUP.md) for complete guide.

**TL;DR:**
```bash
npm install
cp .env.example .env
# Edit .env with your bot mnemonic
npm run build
npm start
```

### For Developers

See implementation details below.

## 📡 How It Works

```bash
# Generate new mnemonic for operator wallet
npx @cosmjs/cli@latest
> const wallet = await DirectSecp256k1HdWallet.generate(12)
> console.log(wallet.mnemonic)
```

**⚠️ PENTING:** Simpan mnemonic ini dengan aman! Wallet ini akan digunakan untuk menjalankan transaksi auto-compound.

### 2. Fund Operator Wallet

Bot membutuhkan gas fee untuk setiap transaksi auto-compound. Pastikan operator wallet memiliki cukup token di setiap chain yang akan digunakan.

**Cara mendapatkan address operator:**

Setelah bot jalan, check log atau API endpoint `/api/autocompound/status`

Contoh:
- Shido: `shido1h8a79xln9gam52c6wzkulz2txyr0rkcrwcuh60`
- Osmosis: `osmo1h8a79xln9gam52c6wzkulz2txyr0rkcrtp3ck8`

### 3. Configure Environment

```bash
cd backend-api
cp .env.example .env
```

Edit `.env`:

```env
# Server
PORT=4000
NODE_ENV=production

# Auto-Compound Bot
OPERATOR_MNEMONIC=your twelve word mnemonic phrase here for operator wallet
BOT_AUTO_START=true
```

### 4. Install Dependencies

```bash
npm install
```

Dependencies tambahan yang diperlukan:
- `@cosmjs/stargate`
- `@cosmjs/proto-signing`
- `cosmjs-types`

### 5. Build & Run

```bash
# Development
npm run dev

# Production
npm run build
npm start

# Atau dengan PM2
pm2 start ecosystem.config.js
```

## 📡 API Endpoints

### Get Bot Status

```bash
GET /api/autocompound/status
```

Response:
```json
{
  "isRunning": true,
  "operatorAddress": "cosmos1...",
  "tasksCount": 5,
  "tasks": [
    {
      "chainId": "shido_9008-1",
      "granter": "shido1kv0xh9vmsy8jjr9y680kexs4g6y29gmuax0g5e",
      "validator": "shidovaloper1kv0xh9vmsy8jjr9y680kexs4g6y29gmu9v5qte",
      "frequency": "daily",
      "lastRun": "2025-11-28T19:25:00Z"
    }
  ]
}
```

### Start Bot

```bash
POST /api/autocompound/start
```

### Stop Bot

```bash
POST /api/autocompound/stop
```

### Load Tasks from Chain

```bash
POST /api/autocompound/load-tasks/:chainId
```

Example:
```bash
curl -X POST http://localhost:4000/api/autocompound/load-tasks/shido_9008-1
```

### Manual Trigger

```bash
POST /api/autocompound/execute
Content-Type: application/json

{
  "chainId": "shido_9008-1",
  "granter": "shido1kv0xh9vmsy8jjr9y680kexs4g6y29gmuax0g5e",
  "validator": "shidovaloper1kv0xh9vmsy8jjr9y680kexs4g6y29gmu9v5qte"
}
```

## 🔄 Cara Kerja

1. **Initialization**: Bot membaca `OPERATOR_MNEMONIC` dan generate address untuk setiap chain prefix
2. **Task Loading**: Query semua authz grants dari blockchain dimana bot adalah grantee
3. **Scheduling**: Jalankan check setiap 1 jam
4. **Execution**: 
   - Check apakah task sudah waktunya run (based on frequency)
   - Query rewards yang available
   - Skip jika rewards < 0.01 token (gas fee tidak worth it)
   - Execute `MsgExec` dengan 2 message:
     - `MsgWithdrawDelegatorReward` - claim rewards
     - `MsgDelegate` - delegate rewards kembali ke validator

## 📊 Monitoring

### Logs

```bash
# PM2 logs
pm2 logs blockchain-api

# Direct logs
tail -f backend-api/logs/out.log
```

### Monitoring Output

```
🚀 API Server running on port 4000
🤖 Initializing Auto-Compound Bot...
✅ Operator Address: cosmos1...
✅ Bot initialized successfully
🚀 Bot started automatically
📊 Loading tasks from shido_9008-1...
✅ Found 3 grants on shido_9008-1
➕ Added task: shido_9008-1-shido1...-shidovaloper1...
✅ Loaded tasks from shido_9008-1

⏰ Processing 3 tasks...
🔄 Executing auto-compound for shido1... on shido_9008-1
💰 Rewards available: 0.145 shido
📡 Broadcasting auto-compound transaction...
✅ Auto-compound successful!
   TX Hash: D0C78B4B805CC537EC87D5CCEB6354428905343F9F02498A68A8D1AD1C5B3D5A
   Height: 24871823
   Gas Used: 171820/600000
```

## 🔐 Security

1. **Mnemonic Safety**: 
   - JANGAN commit `.env` ke git
   - Gunakan environment variables di production
   - Consider using hardware wallet atau KMS untuk production

2. **Gas Fee Management**:
   - Monitor balance operator wallet
   - Setup alerts untuk low balance
   - Calculate gas fee requirements berdasarkan task count

3. **Grant Permissions**:
   - Bot hanya bisa execute apa yang di-grant
   - User full control untuk revoke grant kapan saja
   - Grant punya expiration date (default 1 tahun)

## 🛠️ Troubleshooting

### Bot tidak claim rewards

**Check:**
1. Rewards balance > 0.01 token?
2. Gas fee cukup di operator wallet?
3. Grant masih valid (belum expired)?
4. Frequency sudah sesuai waktu?

### Transaction failed

**Common errors:**
- `out of gas`: Increase gas limit di `AutoCompoundBot.ts`
- `insufficient funds`: Fund operator wallet
- `authorization not found`: Grant expired atau tidak ada
- `invalid grant`: Grant type tidak sesuai

### Tasks tidak ter-load

**Check:**
1. Chain RPC accessible?
2. REST API endpoint working?
3. Operator address format sesuai chain prefix?

## 📝 TODO / Improvements

- [ ] Database untuk tracking task frequency (sekarang in-memory)
- [ ] Webhook notifications untuk successful compound
- [ ] Dashboard UI untuk monitoring
- [ ] Multi-grantee support (multiple operator wallets)
- [ ] Dynamic gas price adjustment
- [ ] Retry mechanism untuk failed transactions
- [ ] Telegram/Discord alerts
- [ ] Performance metrics & analytics

## 🤝 Contributing

Contributions welcome! Please check CONTRIBUTING.md

## 📄 License

MIT License - see LICENSE file
