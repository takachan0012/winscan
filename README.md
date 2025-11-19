# WinScan - Multi-Chain Blockchain Explorer

<div align="center">
  <img src="app/icon.svg" alt="WinScan Logo" width="120" height="120" />
</div>

**WinScan** is a modern, professional multi-chain blockchain explorer built with Next.js 14 and TypeScript. Monitor multiple Cosmos SDK-based blockchains in real-time with an elegant, minimalist interface.

<div align="center">

[![Website](https://img.shields.io/badge/Website-winsnip.xyz-blue?style=for-the-badge&logo=google-chrome)](https://winsnip.xyz)
[![Twitter](https://img.shields.io/badge/Twitter-@winsnip-1DA1F2?style=for-the-badge&logo=twitter)](https://twitter.com/winsnip)
[![Telegram](https://img.shields.io/badge/Telegram-WinSnip-26A5E4?style=for-the-badge&logo=telegram)](https://t.me/winsnip)
[![GitHub](https://img.shields.io/badge/GitHub-winsnip--official-181717?style=for-the-badge&logo=github)](https://github.com/winsnip-official)

</div>

## ✨ Features

- 🌐 **Multi-Chain Support** - Monitor multiple blockchain networks from one dashboard
- 📊 **Real-Time Monitoring** - Live consensus tracking and validator status
- 🔍 **Complete Explorer** - Blocks, transactions, validators, proposals, and more
- 🌍 **Multi-Language** - Support for 7 languages (EN, ID, ZH, JA, HI, RU, VI)
- 🎨 **Modern UI** - Clean, elegant design with dark theme
- 📱 **Responsive** - Works perfectly on desktop, tablet, and mobile
- ⚡ **Fast & Optimized** - Built with performance in mind

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Fork this repository** (Click "Fork" button at top right)

2. **Clone your forked repository**
```bash
git clone https://github.com/winsnip-official/winscan.git
cd winscan
```

3. **Install dependencies**
```bash
npm install
```

4. **Setup environment variables**
```bash
cp .env.example .env
```

Edit `.env` if you want to use different API endpoint (optional):
```env
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
```

5. **Configure your chains**
- Add your chain configurations in `Chains/` directory
- See `Chains/README.md` for chain configuration format

6. **Run development server**
```bash
npm run dev
```

Visit http://localhost:3000

## 📁 Project Structure

```
winscan/
├── app/                    # Next.js app directory
│   ├── [chain]/           # Dynamic chain routes
│   ├── api/               # API routes (proxy)
│   └── page.tsx           # Home page
├── components/            # React components
├── Chains/               # Chain configurations
├── lib/                  # Utility functions
├── types/                # TypeScript types
└── public/               # Static assets
```

## 🔌 API Backend

This explorer uses **WinSnip API** as the backend service:
- **API URL**: https://ssl.winsnip.xyz
- Public and free to use
- Supports multiple Cosmos chains
- Real-time data sync

### Self-Hosted Backend (Optional)

For advanced users who want to run their own API backend:
- Backend repository: Coming soon
- Requires VPS and Node.js
- Full control over data and endpoints

Default configuration uses our public API, so you don't need to setup backend.

## 🔧 Configuration

### Adding New Chains

Create a JSON file in `Chains/` directory:

```json
{
  "chain_name": "your-chain",
  "chain_id": "your-chain-1",
  "pretty_name": "Your Chain",
  "status": "live",
  "network_type": "mainnet",
  "logo": "https://your-logo-url.png",
  "addr_prefix": "your",
  "rpc": [
    {
      "address": "https://rpc.your-chain.com",
      "provider": "Your Provider"
    }
  ],
  "api": [
    {
      "address": "https://api.your-chain.com",
      "provider": "Your Provider"
    }
  ],
  "assets": [
    {
      "name": "Your Token",
      "symbol": "YOURTOKEN",
      "denom": "uyourtoken",
      "decimals": 6
    }
  ]
}
```

### Environment Variables

**Frontend (.env)**
```env
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
```

By default, WinScan uses our public API. You can change this to your own API endpoint if you're running a self-hosted backend.

## 🚀 Deployment

### Deploy Frontend (Vercel)

1. **Connect to Vercel**
```bash
npm run build
vercel --prod
```

2. **Set Environment Variable**
In Vercel dashboard, add:
```
NEXT_PUBLIC_API_URL=https://ssl.winsnip.xyz
```

3. **Deploy**
Every push to main branch will auto-deploy.

### Custom Domain (Optional)

Add your domain in Vercel dashboard → Domains

## 📝 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## 🔐 Security & Permissions

### Repository Protection

This repository is configured with branch protection rules:

- ✅ **Public Repository** - Anyone can view and fork
- ✅ **Fork to Contribute** - Contributors must fork first
- ❌ **No Direct Commits** - Main branch is protected
- ✅ **Pull Request Required** - All changes via PR
- ✅ **Review Required** - PRs need approval before merge

### How to Contribute

1. **Fork** this repository
2. **Clone** your fork
3. Create a **new branch** (`git checkout -b feature/amazing-feature`)
4. **Commit** your changes (`git commit -m 'Add amazing feature'`)
5. **Push** to your fork (`git push origin feature/amazing-feature`)
6. Open a **Pull Request**

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
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
- **Blocks** - Real-time block explorer
- **Transactions** - Transaction search and details
- **Accounts** - Account balances and history
- **Validators** - Validator list and details
- **Proposals** - Governance proposals
- **Assets** - Token information

### ⚙️ Advanced Features
- **Consensus** - Real-time consensus monitoring
- **State Sync** - State sync configuration generator
- **Network** - Network information and endpoints
- **Uptime** - Validator uptime tracking

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

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

**Contribution Rules:**
- Follow existing code style
- Write clear commit messages
- Update documentation if needed
- Test your changes before submitting

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
| <img src="https://file.winsnip.xyz/file/uploads/axone.jpg" width="20"/> **Axone** | Mainnet | 🟢 Live |
| <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/bitbadges/images/bitbadgeslogo.png" width="20"/> **BitBadges** | Mainnet | 🟢 Live |
| <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/gitopia/images/gitopia.png" width="20"/> **Gitopia** | Mainnet | 🟢 Live |
| <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/humans/images/humans.png" width="20"/> **Humans.ai** | Mainnet | 🟢 Live |
| <img src="https://file.winsnip.xyz/file/uploads/shido.jpg" width="20"/> **Shido** | Mainnet | 🟢 Live |

</div>

### Testnets
<div align="center">

| Chain | Network | Status |
|-------|---------|--------|
| <img src="https://file.winsnip.xyz/file/uploads/emperia.jpg" width="20"/> **Emperia** | Testnet | 🟡 Testing |
| <img src="https://file.winsnip.xyz/file/uploads/safrochain.jpg" width="20"/> **Safrochain** | Testnet | 🟡 Testing |
| <img src="https://file.winsnip.xyz/file/uploads/Lumera.jpg" width="20"/> **Lumera** | Testnet | 🟡 Testing |
| <img src="https://file.winsnip.xyz/file/uploads/chinhodega.jpg" width="20"/> **CNHO-Stables** | Testnet | 🟡 Testing |

</div>

**Want to add your chain?** Create a JSON config in `Chains/` directory and submit a PR!

## 🤝 Sponsors

We are proud to be sponsored by these amazing projects:

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
        <img src="https://file.winsnip.xyz/file/uploads/axone.jpg" width="80" height="80" alt="Axone" style="border-radius: 50%;"/>
        <br />
        <b>Axone</b>
      </a>
      <br />
      <sub>Decentralized Knowledge</sub>
    </td>
    <td align="center" width="200">
      <a href="https://bitbadges.io" target="_blank">
        <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/bitbadges/images/bitbadgeslogo.png" width="80" height="80" alt="BitBadges" style="border-radius: 50%;"/>
        <br />
        <b>BitBadges</b>
      </a>
      <br />
      <sub>Digital Badges Protocol</sub>
    </td>
  </tr>
</table>

### Become a Sponsor

Interested in sponsoring WinScan? Contact us:
- 📧 Email: [winsnip@winsnip.xyz](mailto:winsnip@winsnip.xyz)
- 💬 Telegram: [@winsnip](https://t.me/winsnip)

</div>

## 📈 Roadmap

- [ ] WebSocket support for real-time updates
- [ ] Advanced analytics and charts
- [ ] IBC tracking
- [ ] NFT explorer
- [ ] Token swap integration
- [ ] Wallet integration

---

<div align="center">

**Made with ❤️ by [WinSnip](https://winsnip.xyz) for the Cosmos ecosystem**

[![Website](https://img.shields.io/badge/🌐-winsnip.xyz-blue)](https://winsnip.xyz)
[![Twitter](https://img.shields.io/badge/🐦-@winsnip-1DA1F2)](https://twitter.com/winsnip)
[![Telegram](https://img.shields.io/badge/💬-WinSnip-26A5E4)](https://t.me/winsnip)

⭐ **Star this repo if you find it useful!**

</div>
