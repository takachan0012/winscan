# WinScan - Multi-Chain Blockchain Explorer

<div align="center">
  <img src="app/icon.svg" alt="WinScan Logo" width="120" height="120" />
  
  **Modern blockchain explorer for Cosmos ecosystem**
  
  [![Website](https://img.shields.io/badge/Website-winsnip.xyz-blue?style=for-the-badge)](https://winsnip.xyz)
  [![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
  [![Twitter](https://img.shields.io/badge/Twitter-@winsnip-1DA1F2?style=for-the-badge)](https://twitter.com/winsnip)
</div>

## ✨ Features

### Core Features
- 🌐 **Multi-Chain Support** - Cosmos SDK chains with IBC compatibility
- 📊 **Real-Time Tracking** - Live blocks, transactions, validators monitoring
- 💼 **Wallet Integration** - Keplr, Leap, Cosmostation support
- 🔗 **IBC Tracking** - Cross-chain transfer monitoring
- 🗳️ **Governance** - View and vote on proposals
- 📈 **Validator Analytics** - Uptime tracking, commission, voting power, 24h/7d/30d stats
- 🌍 **Multi-Language** - 7 languages support (EN, ID, JP, KR, CN, ES, RU)
- 🎨 **Modern UI** - Dark theme, responsive design
- 📱 **PWA Ready** - Installable Progressive Web App with offline support

### EVM Support
- ⚡ **EVM Explorer** - Native support for Cosmos chains with EVM sidechain
- 🔍 **EVM Blocks** - Real-time block tracking with gas statistics
- 💸 **EVM Transactions** - Transaction details with gas info & hash copy
- 👛 **EVM Addresses** - Balance, transaction history, token holdings
- 🔗 **Dual Chain** - Seamless navigation between Cosmos & EVM
- 🌐 **WebSocket Support** - Real-time updates via EVM WSS endpoints
- ⚡ **Parallel Fetching** - Race condition for fastest API response
- 📊 **Gas Analytics** - Average gas used, gas limit tracking

### Advanced Features
- 🤖 **Auto-Compound Bot** - Automated staking rewards compounding
- 📊 **Token Analytics** - Real-time price tracking, supply metrics
- 💰 **Asset Management** - Multi-asset support, holder tracking
- 🔄 **State Sync** - Fast node synchronization endpoints
- 🚀 **Performance** - Optimized with caching, CDN, and stale-while-revalidate
- 📦 **Smart Caching** - 5-minute cache with background refresh
- 🔄 **Auto-Refresh** - 4-second background updates for real-time data
- 🎯 **Copy to Clipboard** - One-click copy for hashes, addresses
- 📋 **Transaction Icons** - Visual indicators for blocks, transactions
- 🔐 **Secure** - Server-side API with CORS handling

### 🤖 Telegram Monitor Bot
- 📢 **Real-Time Notifications** - Instant alerts for validator missed blocks & governance proposals
- 🗳️ **Governance Alerts** - Auto-notify when new proposals enter voting period
- 🌐 **Multi-Chain Support** - Monitor 32+ Cosmos SDK chains simultaneously
- ⚡ **Smart Monitoring** - Configurable thresholds, cooldown periods, anti-spam
- 📊 **Live Statistics** - Check active proposals, validator uptime, chain status
- 🔗 **Direct Voting Links** - One-click buttons to vote on WinScan
- 🚀 **High Performance** - Parallel API requests, backend proxy optimization

**🔗 Try Now:** [@winscan_monitor_bot](https://t.me/winscan_monitor_bot)

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/winsnip-official/winscan.git
cd winscan

# Install dependencies
npm install

# Run development server
npm run dev
```

Visit http://localhost:3000

## 📖 Documentation

- **[Telegram Monitor Bot](telegram-monitor-bot/README.md)** - Real-time validator & governance alerts
- **[Auto-Compound Bot Guide](autocompound-bot/README.md)** - Setup validator auto-compound bot
- **[Chain Configuration Guide](CHAIN-GUIDELINES.md)** - Add your blockchain
- **[Contributing Guide](CONTRIBUTING.md)** - Contribution guidelines
- **[Security Policy](SECURITY.md)** - Report vulnerabilities
- **[License](LICENSE)** - Usage terms and restrictions

## 🤖 Auto-Compound Bot

WinScan includes a standalone auto-compound bot for validators to provide staking rewards compounding service to their delegators.

**Key Features:**
- ✅ Automated rewards compounding using Authz grants
- ✅ Multi-chain support (Cosmos SDK & EVM-compatible)
- ✅ Validator commission claiming
- ✅ Governance auto-voting
- ✅ Configurable frequency (hourly/daily/weekly/monthly)

**Quick Setup:**
```bash
cd autocompound-bot
npm install
cp .env.example .env
# Edit .env with your mnemonic
npm run build
npm start
```

**📚 Full Documentation:** [autocompound-bot/README.md](autocompound-bot/README.md)

## 📢 Telegram Monitor Bot

**Real-time monitoring and alerts for Cosmos validators and governance!**

The Telegram Monitor Bot provides instant notifications for validator performance issues and governance proposals across 32+ Cosmos SDK chains.

**Key Features:**
- ✅ **Missed Blocks Alerts** - Get notified when validators miss blocks
- ✅ **Governance Notifications** - Never miss a voting opportunity
- ✅ **Multi-Chain Support** - Monitor 32+ chains simultaneously
- ✅ **Smart Thresholds** - Configurable missed blocks limits
- ✅ **Anti-Spam** - Cooldown periods prevent notification flooding
- ✅ **Direct Voting** - One-click buttons to vote on WinScan
- ✅ **Live Statistics** - Check active proposals and validator uptime

**Available Commands:**
```
/start       - Start the bot
/subscribe   - Subscribe to validator/chain alerts
/list        - View your subscriptions
/proposals   - Check active governance proposals
/stats       - View chain statistics
/unsubscribe - Remove subscriptions
/help        - Show all commands
```

**Example Alerts:**

*Missed Blocks Alert:*
```
⚠️ MISSED BLOCKS ALERT ⚠️

┌─ 🔗 Chain: AtomOne Mainnet
├─ 👤 Validator: WinSnip Validator
├─ 📍 Address: atonevaloper1xxx...
└─ ⚡ Missed: 50 blocks

🚨 Action Required!
Your validator has missed 50 blocks.
Please check your validator node immediately.

⏰ Alert will not repeat for 1 hour
```

*Governance Proposal Alert:*
```
🗳️ NEW GOVERNANCE PROPOSAL 🗳️

┌─ 🔗 Chain: AtomOne Mainnet
├─ 🏷️ Proposal ID: #19
├─ 📝 Title: Update dynamic min deposit
├─ 💬 Description: During the v3 upgrade...
└─ 🗓️ Voting Period: 12/11/2025 ➜ 4 day(s) left

📢 Cast Your Vote!
Participate in governance to shape the future of AtomOne Mainnet.

[🗳️ Vote on WinScan]
⏱️ Don't miss the voting deadline!
```

**🔗 Start Monitoring:** [@winscan_monitor_bot](https://t.me/winscan_monitor_bot)

**📚 Full Documentation:** [telegram-monitor-bot/README.md](telegram-monitor-bot/README.md)

## 🔧 Configuration

### Adding New Chains

1. Create `yourchain-mainnet.json` in `Chains/` directory
2. Configure RPC, API endpoints, and token details
3. See [CHAIN-GUIDELINES.md](CHAIN-GUIDELINES.md) for complete format

### Environment Variables

```env
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm run build
vercel --prod
```

Add environment variable in Vercel dashboard:
```
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
```

## 🛠️ Tech Stack

<div align="center">

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **API** | REST (WinSnip Public) |
| **Wallet** | Keplr / Leap / Cosmostation |
| **EVM** | ethers.js, JSON-RPC |
| **Blockchain** | CosmJS, Cosmos SDK |

</div>

## 📜 License & Copyright

**© 2025 WinSnip Official. All Rights Reserved.**

This project is licensed under **MIT License with Additional Restrictions**:

✅ **ALLOWED:**
- Use for personal, educational, or commercial purposes
- Fork and modify the code
- Distribute and sublicense

❌ **PROHIBITED:**
- Remove or alter WinSnip branding, logos, or attribution
- Claim this work as your own
- Misrepresent the origin of this software

⚠️ **REQUIRED:**
- Maintain copyright notice and license in all copies
- Keep visible attribution to WinSnip in public deployments
- Include "Built on Trusted Infrastructure" or similar attribution

**For full license terms, see [LICENSE](LICENSE) file.**

Violation of these terms may result in legal action and license revocation.

## 🤝 Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

**Quick steps:**
1. Fork this repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request to `dev` branch

## 📞 Support

- 🌐 Website: [winsnip.xyz](https://winsnip.xyz)
- 🤖 Telegram Bot: [@winscan_monitor_bot](https://t.me/winscan_monitor_bot)
- 🐦 Twitter: [@winsnip](https://twitter.com/winsnip)
- 💬 Telegram: [t.me/winsnip](https://t.me/winsnip)
- 💻 GitHub: [github.com/winsnip-official](https://github.com/winsnip-official)

## 💎 Supported Chains

### Mainnets (19 Chains)

<div align="center">

| Chain | Logo | Type | Status |
|-------|------|------|--------|
| **AtomOne** | <img src="https://pbs.twimg.com/profile_images/1891894823390429185/9swkoZNn_400x400.png" width="24"/> | Cosmos | ✅ Active |
| **Axone** | <img src="https://pbs.twimg.com/profile_images/1841523650043772928/EeZIYE7B_400x400.jpg" width="24"/> | Cosmos | ✅ Active |
| **BitBadges** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/bitbadges/images/bitbadgeslogo.png" width="24"/> | Cosmos | ✅ Active |
| **CNHO Stables** | <img src="https://pbs.twimg.com/profile_images/1802555804798857216/ZTqy2yxX_400x400.jpg" width="24"/> | Cosmos | ✅ Active |
| **CosmosHub** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png" width="24"/> | Cosmos | ✅ Active |
| **Gitopia** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/gitopia/images/gitopia.png" width="24"/> | Cosmos | ✅ Active |
| **Humans.ai** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/humans/images/heart-dark-mode.svg" width="24"/> | Cosmos | ✅ Active |
| **Lava Network** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/lava/images/lava.png" width="24"/> | Cosmos | ✅ Active |
| **Lumera** | <img src="https://pbs.twimg.com/profile_images/1914464060265127936/z2ONvvpp_400x400.png" width="24"/> | Cosmos | ✅ Active |
| **Noble** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/stake.png" width="24"/> | Cosmos | ✅ Active |
| **Osmosis** | <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/12220.png" width="24"/> | Cosmos | ✅ Active |
| **Paxi Network** | <img src="https://file.winsnip.xyz/file/uploads/paxi.jpg" width="24"/> | Cosmos | ✅ Active |
| **Shido** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/shido/images/shido.png" width="24"/> | Cosmos+EVM ⚡ | ✅ Active |
| **Sunrise** | <img src="https://pbs.twimg.com/profile_images/1950927820290715648/1HjqE_hD_400x400.jpg" width="24"/> | Cosmos | ✅ Active |
| **Tellor** | <img src="https://pbs.twimg.com/profile_images/1855433907556044800/_Bo9JjTR_400x400.png" width="24"/> | Cosmos | ✅ Active |
| **Uptick Network** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/uptick/images/uptick.png" width="24"/> | Cosmos+EVM ⚡ | ✅ Active |
| **Warden Protocol** | <img src="https://pbs.twimg.com/profile_images/1904848026742484992/nO3RP237_400x400.jpg" width="24"/> | Cosmos+EVM ⚡ | ✅ Active |
| **XRPL EVM Sidechain** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/xrplevm/images/xrplevm.png" width="24"/> | Cosmos+EVM ⚡ | ✅ Active |
| **Zenrock** | <img src="https://pbs.twimg.com/profile_images/1829585852831285259/EAxFe-gB_400x400.png" width="24"/> | Cosmos | ✅ Active |

</div>

### Testnets (11 Chains)

<div align="center">

| Chain | Logo | Network |
|-------|------|---------|
| **AtomOne** | <img src="https://pbs.twimg.com/profile_images/1891894823390429185/9swkoZNn_400x400.png" width="24"/> | Testnet |
| **CosmosHub** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png" width="24"/> | Testnet |
| **Empeiria** | <img src="https://pbs.twimg.com/profile_images/1887069794798632960/IvxbLJcg_400x400.jpg" width="24"/> | Testnet |
| **Kiichain** | <img src="https://pbs.twimg.com/profile_images/1800553180083666944/zZe128CW_400x400.jpg" width="24"/> | Testnet |
| **Lumera** | <img src="https://pbs.twimg.com/profile_images/1914464060265127936/z2ONvvpp_400x400.png" width="24"/> | Testnet |
| **Noble** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/stake.png" width="24"/> | Testnet |
| **Osmosis** | <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/12220.png" width="24"/> | Testnet |
| **Safrochain** | <img src="https://pbs.twimg.com/profile_images/1938593981517955072/vTcJ4t5i_400x400.jpg" width="24"/> | Testnet |
| **Warden Barra** | <img src="https://pbs.twimg.com/profile_images/1904848026742484992/nO3RP237_400x400.jpg" width="24"/> | Testnet |
| **XRPL EVM** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/xrplevm/images/xrplevm.png" width="24"/> | Testnet |
| **Zenrock** | <img src="https://pbs.twimg.com/profile_images/1829585852831285259/EAxFe-gB_400x400.png" width="24"/> | Testnet |

</div>

**⚡ EVM Compatible Chains:** Shido, Uptick Network, Warden Protocol, XRPL EVM Sidechain support both Cosmos and EVM transactions with WebSocket real-time updates

**Want to add your chain?** See [CHAIN-GUIDELINES.md](CHAIN-GUIDELINES.md)

---

<div align="center">

**Made with ❤️ by [WinSnip](https://winsnip.xyz)**

⭐ Star this repo if you find it useful!

[![Website](https://img.shields.io/badge/🌐-winsnip.xyz-blue)](https://winsnip.xyz)
[![Twitter](https://img.shields.io/badge/🐦-@winsnip-1DA1F2)](https://twitter.com/winsnip)
[![Telegram](https://img.shields.io/badge/💬-WinSnip-26A5E4)](https://t.me/winsnip)

</div>
