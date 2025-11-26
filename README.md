# WinScan - Multi-Chain Blockchain Explorer

<div align="center">
  <img src="app/icon.svg" alt="WinScan Logo" width="120" height="120" />
  
  **Modern blockchain explorer for Cosmos ecosystem**
  
  [![Website](https://img.shields.io/badge/Website-winsnip.xyz-blue?style=for-the-badge)](https://winsnip.xyz)
  [![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
  [![Twitter](https://img.shields.io/badge/Twitter-@winsnip-1DA1F2?style=for-the-badge)](https://twitter.com/winsnip)
</div>

## ✨ Features

- 🌐 Multi-chain support for Cosmos networks
- 📊 Real-time blocks, transactions, validators tracking
- 💼 Keplr wallet integration (stake, vote, transfer)
- 🗳️ Governance proposals with voting
- 📈 Validator uptime monitoring
- 🌍 7 languages support
- 🎨 Modern dark theme UI
- 📱 Fully responsive

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

- **[Chain Configuration Guide](CHAIN-GUIDELINES.md)** - Add your blockchain
- **[Contributing Guide](CONTRIBUTING.md)** - Contribution guidelines
- **[Security Policy](SECURITY.md)** - Report vulnerabilities
- **[License](LICENSE)** - Usage terms and restrictions

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

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API**: WinSnip public API

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

### Mainnets
- Paxi Network, Axone, BitBadges, Gitopia, Humans.ai, Shido

### Testnets
- CNHO-Stables, Safrochain, Lumera

**Want to add your chain?** See [CHAIN-GUIDELINES.md](CHAIN-GUIDELINES.md)

---

<div align="center">

**Made with ❤️ by [WinSnip](https://winsnip.xyz)**

⭐ Star this repo if you find it useful!

[![Website](https://img.shields.io/badge/🌐-winsnip.xyz-blue)](https://winsnip.xyz)
[![Twitter](https://img.shields.io/badge/🐦-@winsnip-1DA1F2)](https://twitter.com/winsnip)
[![Telegram](https://img.shields.io/badge/💬-WinSnip-26A5E4)](https://t.me/winsnip)

</div>
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts
- **API**: REST API (WinSnip public endpoint)

## 📊 Features Breakdown

### 🏠 Dashboard
- Overview statistics
- Network status
- Chain selector

### 🔍 Explorer
- **Blocks** - Real-time block explorer with transaction count
- **Transactions** - Transaction search and detailed information
- **Accounts** - Account balances, delegations, unbonding, and transaction history
- **Validators** - Complete validator list with voting power, commission, and status
- **Validator Detail** - Advanced validator page with:
  - Realtime uptime monitoring (150-block grid)
  - Consensus address conversion (valcons + hex)
  - Delegators and unbonding delegations list
  - Transaction history via RPC
  - Integrated stake management modal
- **Proposals** - Governance proposals with voting interface
- **Assets** - Token information and supply details

### ⚙️ Advanced Features
- **Consensus** - Real-time consensus monitoring with pre-commit tracking
- **State Sync** - State sync configuration generator for quick node setup
- **Network** - Network information, RPC/API endpoints, and peers
- **Uptime** - Validator uptime tracking with historical data
- **Parameters** - Chain parameters (staking, slashing, governance, distribution)
- **IBC Relayers** - Inter-blockchain communication connections
  - 🌐 Connected chains overview with logos from Cosmos Chain Registry
  - 📊 Channel statistics (total, open channels)
  - 📦 Packet statistics (sent/received)
  - 🔗 Detailed channel view with connection mapping
  - 🔄 Auto-refresh every 10 minutes for smooth updates

### 💼 Wallet Operations
- **Staking** - Delegate, redelegate, undelegate with custom amounts or percentages
- **Rewards** - Withdraw rewards from single or all validators at once
- **Voting** - Vote on governance proposals with weighted options
- **Transfers** - Send tokens with memo support
- **Unjail** - Unjail your validator after downtime
- **Commission Withdrawal** - Validators can withdraw commission earnings

## 🌍 Multi-Language Support

Supported languages:
- 🇬🇧 English
- 🇮🇩 Indonesian
- 🇨🇳 Chinese
- 🇯🇵 Japanese
- 🇮🇳 Hindi
- 🇷🇺 Russian
- 🇻🇳 Vietnamese

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### What this means:
- ✅ Free to use, modify, and distribute
- ✅ Can use commercially
- ✅ Can fork and create your own version
- ⚠️ Must include original license
- ⚠️ No warranty provided

## 📞 Support & Community

Need help or want to connect? Join our community:

- 🌐 **Website**: [winsnip.xyz](https://winsnip.xyz)
- 🐦 **Twitter**: [@winsnip](https://twitter.com/winsnip)
- 💬 **Telegram**: [t.me/winsnip](https://t.me/winsnip)
- 💻 **GitHub**: [github.com/winsnip-official](https://github.com/winsnip-official)
- 🐛 **Issues**: [GitHub Issues](https://github.com/winsnip-official/winscan/issues)

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Cosmos SDK](https://cosmos.network/)
- Inspired by [Ping.pub](https://ping.pub/) and [Mintscan](https://www.mintscan.io/)

## 💎 Supported Chains

WinScan currently supports the following blockchain networks:

### Mainnets
<div align="center">

| Chain | Network | Status |
|-------|---------|--------|
| <img src="https://file.winsnip.xyz/file/uploads/paxi.jpg" width="20"/> **Paxi Network** | Mainnet | 🟢 Live |
| <img src="https://pbs.twimg.com/profile_images/1841523650043772928/EeZIYE7B_400x400.jpg" width="20"/> **Axone** | Mainnet | 🟢 Live |
| <img src="https://pbs.twimg.com/profile_images/1948901739765084160/RdCGkJt4_400x400.jpg" width="20"/> **BitBadges** | Mainnet | 🟢 Live |
| <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/gitopia/images/gitopia.png" width="20"/> **Gitopia** | Mainnet | 🟢 Live |
| <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/humans/images/heart-dark-mode.svg" width="20"/> **Humans.ai** | Mainnet | 🟢 Live |
| <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/shido/images/shido.png" width="20"/> **Shido** | Mainnet | 🟢 Live |

</div>

### Testnets
<div align="center">

| Chain | Network | Status |
|-------|---------|--------|
| <img src="https://pbs.twimg.com/profile_images/1802555804798857216/ZTqy2yxX_400x400.jpg" width="20"/> **CNHO-Stables** | Testnet | 🟡 Testing |
| <img src="https://pbs.twimg.com/profile_images/1938593981517955072/vTcJ4t5i_400x400.jpg" width="20"/> **Safrochain** | Testnet | 🟡 Testing |
| <img src="https://pbs.twimg.com/profile_images/1914464060265127936/z2ONvvpp_400x400.png" width="20"/> **Lumera** | Testnet | 🟡 Testing |

</div>

**Want to add your chain?** Create a JSON config in `Chains/` directory and submit a PR!

## 🤝 Partners

We are proud to partner with these amazing projects:

<div align="center">

### Blockchain Networks

<table>
  <tr>
    <td align="center" width="200">
      <a href="https://paxi.network" target="_blank">
        <img src="https://file.winsnip.xyz/file/uploads/paxi.jpg" width="80" height="80" alt="Paxi Network" style="border-radius: 50%;"/>
        <br />
        <b>Paxi Network</b>
      </a>
      <br />
      <sub>The Future of DeFi</sub>
    </td>
    <td align="center" width="200">
      <a href="https://axone.xyz" target="_blank">
        <img src="https://pbs.twimg.com/profile_images/1841523650043772928/EeZIYE7B_400x400.jpg" width="80" height="80" alt="Axone" style="border-radius: 50%;"/>
        <br />
        <b>Axone</b>
      </a>
      <br />
      <sub>Decentralized Knowledge</sub>
    </td>
    <td align="center" width="200">
      <a href="https://bitbadges.io" target="_blank">
        <img src="https://pbs.twimg.com/profile_images/1948901739765084160/RdCGkJt4_400x400.jpg" width="80" height="80" alt="BitBadges" style="border-radius: 50%;"/>
        <br />
        <b>BitBadges</b>
      </a>
      <br />
      <sub>Digital Badges Protocol</sub>
    </td>
  </tr>
</table>

### Become a Partner

Interested in partnering with WinScan? Contact us:
- 📧 Email: [admin@winsnip.xyz](mailto:admin@winsnip.xyz)
- 💬 Telegram: [@winsnip](https://t.me/winsnip)

</div>

## 📈 Roadmap

### Completed ✅
- [x] Multi-chain support with dynamic routing
- [x] Real-time block and transaction explorer
- [x] Validator list with voting power and status
- [x] Governance proposals with voting
- [x] Keplr wallet integration
- [x] Staking operations (delegate, undelegate, redelegate)
- [x] Reward withdrawals (single and all validators)
- [x] Unjail validator functionality
- [x] Realtime validator uptime monitoring (150-block grid)
- [x] Consensus address conversion (valcons + hex)
- [x] Validator transactions via RPC
- [x] Delegators and unbonding delegations display
- [x] Integrated stake management modal
- [x] Multi-language support (7 languages)
- [x] Responsive design for all devices
- [x] IBC Relayers page with chain logos
- [x] Chain Registry integration for logos
- [x] Relayer detail page with channel information
- [x] Packet statistics (sent/received)
- [x] Grouped sidebar navigation with submenu

### In Progress 🚧
- [ ] WebSocket support for real-time updates
- [ ] Advanced analytics and charts
- [ ] Token price integration
- [ ] Historical data visualization

### Planned 📋
- [ ] Token swap integration (Osmosis DEX)
- [ ] Validator ranking and comparison tools
- [ ] Mobile app (React Native)
- [ ] API documentation for developers
- [ ] Custom alerts and notifications

## 🤝 Contributing

**We welcome contributions!** Whether you're fixing bugs, adding features, improving docs, or adding new chains - your help makes WinScan better.

### 🚀 Quick Start

```bash
# 1. Fork & clone
git clone https://github.com/YOUR-USERNAME/winscan.git
cd winscan
npm install

# 2. Create feature branch from dev
git checkout dev
git checkout -b feature/amazing-feature

# 3. Make changes, test, commit
npm run dev
git commit -m "feat: add amazing feature"

# 4. Push and create PR to dev branch
git push origin feature/amazing-feature
```

### 📖 Full Guidelines

**Please read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing:**
- Development workflow & branch strategy
- Coding standards & best practices
- Commit message format
- Pull request process
- Testing guidelines

### 🎯 Good First Issues

New contributor? Look for:
- `good first issue` - Perfect for beginners
- `help wanted` - Community contributions welcome
- `documentation` - Help improve our docs

### 🏆 Contributors

Thank you to all our amazing contributors who have helped make WinScan better! 🎉

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- This section is automatically updated by all-contributors bot -->
<a href="https://github.com/winsnip-official/winscan/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=winsnip-official/winscan" alt="Contributors" />
</a>
<!-- ALL-CONTRIBUTORS-LIST:END -->

**Want to see your name here?** Check out our [Contributing Guide](CONTRIBUTING.md) to get started!

Made with ❤️ by our amazing contributors!

---

<div align="center">

**Made with ❤️ by [WinSnip](https://winsnip.xyz) for the Cosmos ecosystem**

[![Website](https://img.shields.io/badge/🌐-winsnip.xyz-blue)](https://winsnip.xyz)
[![Twitter](https://img.shields.io/badge/🐦-@winsnip-1DA1F2)](https://twitter.com/winsnip)
[![Telegram](https://img.shields.io/badge/💬-WinSnip-26A5E4)](https://t.me/winsnip)

⭐ **Star this repo if you find it useful!**

</div>
