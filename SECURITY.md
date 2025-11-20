# Security Policy

## Reporting a Vulnerability

We take the security of WinScan seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing:
- 📧 **Email**: [admin@winsnip.xyz](mailto:admin@winsnip.xyz)
- 💬 **Telegram**: [@winsnip](https://t.me/winsnip) (for urgent issues)

Please include the following information in your report:
- Type of vulnerability
- Full paths of affected source file(s)
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

After submitting a vulnerability report, you can expect:

1. **Acknowledgment**: We'll acknowledge receipt of your report within 48 hours
2. **Assessment**: We'll assess the vulnerability and determine its severity
3. **Updates**: We'll keep you informed about our progress
4. **Fix & Disclosure**: Once fixed, we'll publicly disclose the vulnerability (with credit to you, if desired)

### Response Timeline

- **Critical vulnerabilities**: Patched within 7 days
- **High severity**: Patched within 14 days  
- **Medium severity**: Patched within 30 days
- **Low severity**: Patched in next regular release

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| dev     | :white_check_mark: |
| < 1.0   | :x:                |

## Security Best Practices

When using WinScan:

### For Users
- Always verify you're on the official domain
- Never share your private keys or seed phrases
- Use hardware wallets for large amounts
- Keep your browser and extensions updated
- Be cautious of phishing attempts

### For Developers
- Keep dependencies up to date
- Follow secure coding practices
- Never commit sensitive data (API keys, passwords)
- Use environment variables for secrets
- Enable 2FA on your GitHub account
- Review code changes carefully before merging

### For Chain Operators
- Use secure RPC/API endpoints (HTTPS only)
- Implement rate limiting
- Monitor for unusual activity
- Keep node software updated
- Use firewall rules to restrict access

## Known Security Considerations

### API Rate Limits
- Public API endpoints may be rate-limited
- Consider running your own backend for production use

### Client-Side Security
- This is a frontend application
- Never enter private keys in the browser
- Use official wallet extensions (Keplr, Leap, etc.)

### Chain Data Verification
- Always verify transaction data on multiple sources
- Don't rely solely on explorer data for critical decisions

## Security Updates

We announce security updates through:
- GitHub Security Advisories
- Release notes
- Twitter ([@winsnip](https://twitter.com/winsnip))
- Telegram ([@winsnip](https://t.me/winsnip))

## Responsible Disclosure

We follow responsible disclosure practices:
- We'll work with you to understand and fix the issue
- We'll credit you in the security advisory (if you wish)
- We won't take legal action against security researchers who:
  - Make a good faith effort to avoid privacy violations
  - Don't exploit vulnerabilities beyond necessary verification
  - Report vulnerabilities promptly
  - Keep vulnerabilities confidential until fixed

## Bug Bounty Program

Currently, we don't have a formal bug bounty program. However:
- We deeply appreciate security research
- We'll publicly acknowledge contributors
- Exceptional findings may receive recognition

## Contact

For security-related inquiries:
- 📧 Email: [admin@winsnip.xyz](mailto:admin@winsnip.xyz)
- 💬 Telegram: [@winsnip](https://t.me/winsnip)

For general questions, use:
- 🐛 [GitHub Issues](https://github.com/winsnip-official/winscan/issues)
- 💬 [Telegram Community](https://t.me/winsnip)

---

**Thank you for helping keep WinScan and our users safe!** 🔒
