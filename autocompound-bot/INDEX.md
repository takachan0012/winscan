# WinScan Auto-Compound Bot

**Standalone bot for Cosmos validators to provide auto-compound service to their delegators.**

## 📁 Project Structure

```
autocompound-bot/          # Standalone bot (this package)
├── src/
│   ├── index.ts          # Express server & bot initialization
│   └── AutoCompoundBot.ts # Core bot logic
├── README.md             # Setup guide for validators
├── ARCHITECTURE.md       # Technical documentation
├── package.json
└── ecosystem.config.js   # PM2 config
```

## 🎯 For Validators

This bot allows you to run auto-compound service for your delegators **without depending on any centralized API**.

**See [README.md](./README.md) for complete setup guide.**

## 🚀 Quick Start

```bash
cd autocompound-bot
npm install
cp .env.example .env
# Edit .env with your bot operator mnemonic
npm run build
npm start
```

## 📖 Documentation

- **[README.md](./README.md)** - Complete setup guide
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical architecture & API reference

## 🔗 Links

- **Main Explorer**: https://github.com/winsnip-official/winscan
- **Discord**: https://discord.gg/winsnip
- **Telegram**: https://t.me/winsnip

## 📄 License

MIT License - Free to use and modify
