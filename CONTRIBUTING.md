# Contributing to WinScan

Thank you for your interest in contributing to WinScan! 🎉

We welcome contributions from the community. This guide will help you get started.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Strategy](#branch-strategy)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Need Help?](#need-help)

## 📜 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect differing opinions and experiences

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- GitHub account

### Fork & Clone

1. **Fork this repository**
   - Click the "Fork" button at the top right of the repository page
   - This creates your own copy under your GitHub account

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR-USERNAME/winscan.git
   cd winscan
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/winsnip-official/winscan.git
   ```

4. **Verify remotes**
   ```bash
   git remote -v
   # origin    https://github.com/YOUR-USERNAME/winscan.git (your fork)
   # upstream  https://github.com/winsnip-official/winscan.git (original)
   ```

### Install Dependencies

```bash
npm install
```

### Environment Setup

```bash
cp .env.example .env
```

Edit `.env` if needed (default values work for most cases).

### Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000 to see the app running.

## 💻 Development Workflow

### ⚠️ IMPORTANT: Always Work on `dev` Branch

**Never push directly to `main`!** All development happens on `dev` branch.

### Step-by-Step Workflow

1. **Switch to dev branch**
   ```bash
   git checkout dev
   ```

2. **⚠️ ALWAYS pull latest changes first**
   ```bash
   git pull origin dev
   ```
   This prevents merge conflicts and ensures you have the latest code.

3. **Create a feature branch**
   ```bash
   # For new features
   git checkout -b feature/your-feature-name
   
   # For bug fixes
   git checkout -b fix/bug-description
   
   # For documentation
   git checkout -b docs/documentation-update
   ```

4. **Make your changes**
   - Write clean, readable code
   - Follow existing code style and patterns
   - Add comments for complex logic
   - Update documentation if needed

5. **Test your changes**
   ```bash
   # Run development server
   npm run dev
   
   # Build to check for errors
   npm run build
   
   # Run linter
   npm run lint
   ```

6. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```
   See [Commit Guidelines](#commit-guidelines) for proper commit message format.

7. **⚠️ Pull again before pushing**
   ```bash
   git pull origin dev
   ```
   Always check for new changes before pushing to avoid conflicts.

8. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

9. **Create Pull Request**
   - Go to your fork on GitHub
   - Click "Pull Request" button
   - **Important:** Select `dev` as the target branch (not `main`)
   - Fill in the PR template with:
     - Clear description of changes
     - Screenshots/videos if UI changes
     - Link to related issues
     - Testing steps

10. **Wait for review**
    - Maintainers will review your PR
    - Address any feedback or requested changes
    - Once approved, your PR will be merged to `dev`

## 🌿 Branch Strategy

### Branch Types

- **`main`** - Production branch
  - Only stable, tested code
  - Direct commits not allowed
  - Only accepts merges from `dev`

- **`dev`** - Development branch
  - Active development happens here
  - All PRs should target this branch
  - Regularly tested before merging to `main`

- **`feature/*`** - New features
  - Example: `feature/wallet-integration`
  - Example: `feature/multi-chain-support`

- **`fix/*`** - Bug fixes
  - Example: `fix/balance-calculation`
  - Example: `fix/mobile-layout`

- **`docs/*`** - Documentation
  - Example: `docs/api-reference`
  - Example: `docs/contributing-guide`

### Branch Lifecycle

```
main (production)
  ↑
  └── dev (development)
        ↑
        ├── feature/new-feature
        ├── fix/bug-fix
        └── docs/documentation
```

## 📝 Coding Standards

### TypeScript

- Use TypeScript for all new files
- Define proper types/interfaces
- Avoid using `any` type when possible
- Use meaningful variable and function names

**Example:**
```typescript
// ❌ Bad
function calc(a: any, b: any) {
  return a + b;
}

// ✅ Good
function calculateTotal(price: number, quantity: number): number {
  return price * quantity;
}
```

### React Components

- Use functional components with hooks
- Keep components focused and small
- Extract reusable logic into custom hooks
- Use proper prop types

**Example:**
```typescript
// ✅ Good component structure
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export default function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={`btn btn-${variant}`}
    >
      {label}
    </button>
  );
}
```

### File Organization

```
components/
  ├── Button.tsx          # Component
  ├── Modal.tsx
  └── ...

lib/
  ├── utils.ts           # Utility functions
  ├── api.ts             # API calls
  └── ...

types/
  ├── chain.ts           # Type definitions
  └── ...
```

### Styling

- Use Tailwind CSS utility classes
- Follow existing design patterns
- Ensure responsive design (mobile-first)
- Use consistent spacing and colors

## 📋 Commit Guidelines

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring (no feature change)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependencies update

### Examples

```bash
# Feature
git commit -m "feat: add Keplr wallet integration"
git commit -m "feat(validators): add uptime monitoring"

# Bug fix
git commit -m "fix: resolve balance calculation error"
git commit -m "fix(mobile): correct header alignment on small screens"

# Documentation
git commit -m "docs: update contributing guidelines"
git commit -m "docs(api): add endpoint documentation"

# Refactor
git commit -m "refactor: simplify transaction fetching logic"

# Style
git commit -m "style: format code with prettier"

# Chore
git commit -m "chore: update dependencies"
git commit -m "chore: add eslint configuration"
```

### Commit Best Practices

- ✅ Write clear, descriptive messages
- ✅ Use present tense ("add feature" not "added feature")
- ✅ Keep subject line under 72 characters
- ✅ Separate subject from body with blank line
- ✅ Use body to explain what and why (not how)
- ❌ Don't commit unfinished work
- ❌ Don't commit commented-out code
- ❌ Don't commit debugging code

## 🔍 Pull Request Process

### Before Creating PR

- [ ] Code builds without errors (`npm run build`)
- [ ] All tests pass
- [ ] Linter shows no errors (`npm run lint`)
- [ ] Changes are tested in browser
- [ ] Documentation updated if needed
- [ ] Commit messages follow guidelines
- [ ] Branch is up to date with `dev`

### PR Title Format

Follow the same format as commit messages:

```
feat: add wallet integration
fix: resolve mobile layout issue
docs: update API documentation
```

### PR Description Template

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring

## Changes Made
- List key changes
- Another change
- One more change

## Screenshots (if applicable)
[Add screenshots or videos of UI changes]

## Testing
How to test these changes:
1. Step one
2. Step two
3. Expected result

## Related Issues
Closes #123
Related to #456

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No console errors
- [ ] Tested on multiple browsers (if UI changes)
```

### PR Review Process

1. Maintainer reviews your PR
2. Automated tests run (if configured)
3. Feedback or approval given
4. Address any requested changes
5. Push updates to same branch
6. Once approved, PR will be merged

## 🧪 Testing

### Manual Testing

Before submitting PR, test these scenarios:

**For UI Changes:**
- [ ] Desktop view (1920x1080)
- [ ] Tablet view (768x1024)
- [ ] Mobile view (375x667)
- [ ] Different browsers (Chrome, Firefox, Safari)
- [ ] Dark theme (if applicable)

**For Features:**
- [ ] Happy path (everything works)
- [ ] Error cases (what if something fails?)
- [ ] Edge cases (empty data, large numbers, etc.)
- [ ] Loading states
- [ ] Error messages

### Build Testing

```bash
# Always run before creating PR
npm run build

# Check for TypeScript errors
npm run lint
```

## 🚫 What NOT to Do

### ❌ Don't Do This

- Push directly to `main` branch
- Commit `node_modules/` folder
- Commit `.env` files with secrets
- Make massive PRs with unrelated changes
- Ignore ESLint/TypeScript errors
- Forget to test your changes
- Copy-paste code without understanding it
- Leave `console.log()` statements
- Use `any` type everywhere
- Hard-code values that should be configurable

### ✅ Do This Instead

- Always work on `dev` branch
- Add dependencies via `package.json`
- Use `.env.example` for environment templates
- Create focused PRs (one feature/fix per PR)
- Fix all linter errors before committing
- Test thoroughly before submitting
- Understand and adapt code to project style
- Remove debug statements before committing
- Use proper TypeScript types
- Use configuration files or environment variables

## 🎯 Good First Issues

New to the project? Look for issues labeled:

- `good first issue` - Perfect for beginners
- `help wanted` - Community contributions welcome
- `documentation` - Help improve docs
- `bug` - Fix existing bugs

## 💡 Need Help?

### Questions?

- 💬 [Telegram Group](https://t.me/winsnip)
- 📧 Email: admin@winsnip.xyz
- 🐛 [Create an Issue](https://github.com/winsnip-official/winscan/issues)

### Before Asking

1. Check existing issues and PRs
2. Read the documentation
3. Search in Telegram group history
4. Google the error message

### When Asking for Help

Provide:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/code snippets
- Your environment (OS, Node version, etc.)

## 🏆 Recognition

All contributors will be:
- Listed in README.md
- Recognized in release notes
- Given credit in commit history

**Top contributors may receive:**
- Direct collaborator access
- Custom Discord/Telegram roles
- Early access to new features

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Best Practices](https://git-scm.com/book/en/v2)

## 🙏 Thank You!

Every contribution, no matter how small, is valuable. Thank you for helping make WinScan better!

---

<div align="center">

**Happy Contributing! 🚀**

If you find this project useful, please give it a ⭐️

[Website](https://winsnip.xyz) • [Twitter](https://twitter.com/winsnip) • [Telegram](https://t.me/winsnip)

</div>
