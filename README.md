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

WinScan supports multiple blockchain networks. To add a new chain:

1. **Create chain configuration file** in `Chains/` directory
2. **Follow naming convention**: `{network}-{type}.json`
   - Example: `lumera-mainnet.json`, `tellor-test.json`
3. **Use the configuration template** with required fields

**📖 For detailed instructions, see [CHAIN-GUIDELINES.md](CHAIN-GUIDELINES.md)**

Quick example:
```json
{
  "chain_name": "your-chain-mainnet",
  "chain_id": "your-chain-1",
  "pretty_name": "Your Chain Mainnet",
  "addr_prefix": "your",
  "rpc": [{"address": "https://rpc.example.com"}],
  "api": [{"address": "https://api.example.com"}],
  "assets": [{
    "name": "Your Token",
    "symbol": "TOKEN",
    "base": "utoken",
    "exponent": 6
  }]
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

We love contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help is welcome.

### Quick Start for Contributors

1. **Fork & Clone**
   ```bash
   git clone https://github.com/YOUR-USERNAME/winscan.git
   cd winscan
   npm install
   ```

2. **Create Feature Branch**
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature
   ```

3. **Make Changes & Test**
   ```bash
   npm run dev
   npm run build
   ```

4. **Commit & Push**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git pull origin dev
   git push origin feature/your-feature
   ```

5. **Create Pull Request** to `dev` branch

### 📖 Detailed Guidelines

**Please read our [Contributing Guide](CONTRIBUTING.md) for:**
- Complete setup instructions
- Development workflow
- Branch strategy (dev vs main)
- Coding standards
- Commit message format
- PR process
- Testing guidelines
- Do's and don'ts

### 🎯 Good First Issues

New to the project? Look for issues labeled:
- `good first issue` - Perfect for beginners
- `help wanted` - Community help welcome
- `documentation` - Help improve docs

### 🏆 Contributors

Thank you to all our amazing contributors! 🎉

<a href="https://github.com/winsnip-official/winscan/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=winsnip-official/winscan" />
</a>

**Want to see your name here?** Check out [CONTRIBUTING.md](CONTRIBUTING.md) and start contributing today!

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
