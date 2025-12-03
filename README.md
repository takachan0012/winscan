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
- 📈 **Validator Analytics** - Uptime, commission, voting power tracking
- 🌍 **Multi-Language** - 7 languages support (EN, ID, JP, KR, CN, ES, RU)
- 🎨 **Modern UI** - Dark theme, responsive design

### EVM Support
- ⚡ **EVM Explorer** - Native support for Cosmos chains with EVM sidechain
- 🔍 **EVM Blocks** - Real-time EVM block tracking
- 💸 **EVM Transactions** - Transaction details with gas info
- 👛 **EVM Addresses** - Balance, transaction history
- 🔗 **Dual Chain** - Seamless navigation between Cosmos & EVM
- 🌐 **CORS-Free** - Server-side API with automatic fallback

### Advanced Features
- 🤖 **Auto-Compound Bot** - Automated staking rewards compounding
- 📊 **Token Analytics** - Price tracking, supply metrics
- 💰 **Asset Management** - Multi-asset support, holder tracking
- 🔄 **State Sync** - Fast node synchronization endpoints
- 🚀 **Performance** - Optimized with caching and CDN
- 📱 **PWA Ready** - Progressive Web App capabilities

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
- 🐦 Twitter: [@winsnip](https://twitter.com/winsnip)
- 💬 Telegram: [t.me/winsnip](https://t.me/winsnip)
- 💻 GitHub: [github.com/winsnip-official](https://github.com/winsnip-official)

## 💎 Supported Chains

### Mainnets (18 Chains)

<div align="center">

| Chain | Logo | Type | Status |
|-------|------|------|--------|
| **AtomOne** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/atomone/images/atone.png" width="24"/> | Cosmos | ✅ Active |
| **Axone** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/axone/images/axone.png" width="24"/> | Cosmos | ✅ Active |
| **BitBadges** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/bitbadges/images/bitbadgeslogo.png" width="24"/> | Cosmos | ✅ Active |
| **CNHO Stables** | <img src="https://explorer.winsnip.xyz/_next/image?url=https%3A%2F%2Fraw.githubusercontent.com%2Fcosmos%2Fchain-registry%2Fmaster%2Ftestnets%2Fcnhostablestestnet%2Fimages%2Fcnho.png&w=48&q=75" width="24"/> | Cosmos | ✅ Active |
| **CosmosHub** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png" width="24"/> | Cosmos | ✅ Active |
| **Gitopia** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/gitopia/images/gitopia.png" width="24"/> | Cosmos | ✅ Active |
| **Humans.ai** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/humans/images/heart-dark-mode.png" width="24"/> | Cosmos | ✅ Active |
| **Lava Network** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/lava/images/lava.png" width="24"/> | Cosmos | ✅ Active |
| **Lumera** | <img src="https://pbs.twimg.com/profile_images/1903755629906006016/Hgmf1MlD_400x400.jpg" width="24"/> | Cosmos | ✅ Active |
| **Noble** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/noble.png" width="24"/> | Cosmos | ✅ Active |
| **Osmosis** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png" width="24"/> | Cosmos | ✅ Active |
| **Paxi Network** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/paxi/images/paxi.png" width="24"/> | Cosmos | ✅ Active |
| **Shido** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/shido/images/shido.png" width="24"/> | Cosmos+EVM ⚡ | ✅ Active |
| **Sunrise** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/sunrise/images/sunrise.png" width="24"/> | Cosmos | ✅ Active |
| **Tellor** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/tellor/images/tellor.png" width="24"/> | Cosmos | ✅ Active |
| **Warden Protocol** | <img src="https://pbs.twimg.com/profile_images/1904848026742484992/nO3RP237_400x400.jpg" width="24"/> | Cosmos+EVM ⚡ | ✅ Active |
| **XRPL EVM Sidechain** | <img src="https://s2.coinmarketcap.com/static/img/coins/64x64/52.png" width="24"/> | Cosmos+EVM ⚡ | ✅ Active |
| **Zenrock** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/zenrock/images/zenrock.png" width="24"/> | Cosmos | ✅ Active |

</div>

### Testnets (10 Chains)

<div align="center">

| Chain | Logo | Network |
|-------|------|---------|
| **AtomOne** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/atomone/images/atone.png" width="24"/> | Testnet |
| **CosmosHub** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png" width="24"/> | Testnet |
| **Empeiria** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/empeiriatestnet/images/empeiria.png" width="24"/> | Testnet |
| **Kiichain** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/kiichainkiiextension/images/kii.png" width="24"/> | Testnet |
| **Lumera** | <img src="https://pbs.twimg.com/profile_images/1903755629906006016/Hgmf1MlD_400x400.jpg" width="24"/> | Testnet |
| **Noble** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/noble/images/noble.png" width="24"/> | Testnet |
| **Osmosis** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png" width="24"/> | Testnet |
| **Safrochain** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/testnets/safrotestnet/images/safro.png" width="24"/> | Testnet |
| **Warden Barra** | <img src="https://pbs.twimg.com/profile_images/1904848026742484992/nO3RP237_400x400.jpg" width="24"/> | Testnet |
| **Zenrock** | <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/zenrock/images/zenrock.png" width="24"/> | Testnet |

</div>

**⚡ EVM Compatible Chains:** Shido, Warden Protocol, XRPL EVM Sidechain support both Cosmos and EVM transactions with WebSocket

**Want to add your chain?** See [CHAIN-GUIDELINES.md](CHAIN-GUIDELINES.md)

---

<div align="center">

**Made with ❤️ by [WinSnip](https://winsnip.xyz)**

⭐ Star this repo if you find it useful!

[![Website](https://img.shields.io/badge/🌐-winsnip.xyz-blue)](https://winsnip.xyz)
[![Twitter](https://img.shields.io/badge/🐦-@winsnip-1DA1F2)](https://twitter.com/winsnip)
[![Telegram](https://img.shields.io/badge/💬-WinSnip-26A5E4)](https://t.me/winsnip)

</div>
