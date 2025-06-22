# 🔍 Auto Text Zoom

<div align="center">

![CI](https://github.com/username/auto-text-zoom/workflows/CI/badge.svg)
![CodeQL](https://github.com/username/auto-text-zoom/workflows/CodeQL/badge.svg)
[![codecov](https://codecov.io/gh/username/auto-text-zoom/branch/main/graph/badge.svg)](https://codecov.io/gh/username/auto-text-zoom)

**🎯 Say goodbye to squinting at tiny text!**

*The Chrome extension that automatically makes small text readable*

[📥 Download](#installation) • [🚀 Features](#features) • [⚙️ Settings](#usage) • [💬 Support](#support)

</div>

---

## 🎉 What is Auto Text Zoom?

Ever visited a website and found yourself leaning closer to the screen, squinting at impossibly small text? 😤 We've all been there! 

**Auto Text Zoom** is your vision's best friend 👀✨ - it automatically detects when text is too small and smoothly zooms the page to make everything perfectly readable. No more manual zooming, no more eye strain!

## ✨ Features

🔍 **Smart Detection** - Automatically spots tiny text before you do  
⚡ **Instant Action** - Smooth zoom transitions that feel natural  
🎚️ **Your Rules** - Set your perfect font size threshold (2-24px)  
📏 **Custom Zoom** - Choose your ideal zoom level (100-200%)  
💾 **Memory Magic** - Remembers your preferences across all devices  
🎯 **Respectful** - Never overrides your existing zoom settings  
🔄 **Easy Reset** - One-click return to original size  
🧠 **Content Smart** - Focuses on actual content, ignores decorative text  

## 🚀 Installation

### 📦 Quick Install (Recommended)
1. 🎁 Download from our [Releases page](https://github.com/username/auto-text-zoom/releases)
2. 📂 Extract the zip file
3. 🌐 Open Chrome → `chrome://extensions/`
4. 🔧 Enable "Developer mode" (top right)
5. 📁 Click "Load unpacked" → Select your extracted folder
6. 🎉 You're ready to browse comfortably!

### 👨‍💻 For Developers
```bash
git clone https://github.com/username/auto-text-zoom.git
cd auto-text-zoom
npm install
npm run build
```

## 🎮 Usage

### Getting Started
1. **📌 Look for the extension icon** in your Chrome toolbar
2. **🖱️ Click it** to open your personal control center
3. **⚙️ Customize away:**
   - 📏 **Font Size Threshold**: Pages with smaller text get the zoom treatment
   - 🔍 **Zoom Power**: How much bigger everything gets
4. **🌐 Browse normally** - we'll handle the rest!
5. **🔄 Reset anytime** with the handy button that appears on zoomed pages

### 🎛️ Control Center
- **📏 Minimum Font Size Slider**: 2px → 24px *(default: 15px)*
- **🔍 Zoom Level Slider**: 100% → 200% *(default: 135%)*
- **💾 Auto-save**: Changes apply instantly!

### ⌨️ Pro Tips
- `Ctrl/Cmd + S`: Quick save in settings
- `Ctrl/Cmd + R`: Reset to factory defaults

## 🔧 For Developers

### 🛠️ Tech Stack
- **Manifest V3** - Future-proof Chrome extension
- **Vanilla JS** - Fast and lightweight  
- **Jest** - Comprehensive test coverage
- **ESLint** - Clean, consistent code
- **GitHub Actions** - Automated CI/CD

### 🏗️ Development Setup
```bash
# Clone & setup
git clone https://github.com/username/auto-text-zoom.git
cd auto-text-zoom
npm install

# Available commands
npm test              # 🧪 Run tests
npm run test:watch    # 👀 Watch mode testing
npm run test:coverage # 📊 Coverage reports
npm run lint          # 🔍 Code quality check
npm run lint:fix      # 🔧 Auto-fix issues
npm run build         # 🏗️ Full build pipeline
```

### 🏛️ Architecture
```
🏗️ Extension Structure
├── 📄 manifest.json       # Extension config
├── 🎬 content.js         # Page analyzer & zoom logic
├── 🎛️ background.js      # Chrome API handler
├── 🎨 popup.html         # Beautiful settings UI
├── ⚙️ popup.js          # Settings magic
└── 🧪 test/             # Comprehensive tests
    ├── content.test.js
    ├── background.test.js
    ├── popup.test.js
    └── integration.test.js
```

### 🔄 How the Magic Works
1. **🔍 Content Script** scans every page for tiny text
2. **🎛️ Background Worker** handles Chrome's zoom APIs safely
3. **⚙️ Settings Panel** syncs your preferences across devices
4. **💬 Messaging System** keeps everything talking smoothly

## 🤝 Contributing

We love contributors! 💖 Here's how to join the fun:

1. 🍴 Fork this repo
2. 🌿 Create your feature branch: `git checkout -b feature/amazing-idea`
3. ✨ Make your magic happen
4. 🧪 Add tests (we're test lovers!)
5. ✅ Make sure everything passes: `npm test`
6. 📝 Commit: `git commit -m 'Add amazing feature'`
7. 🚀 Push: `git push origin feature/amazing-idea`
8. 🎉 Open a Pull Request

### 📋 Contribution Checklist
- ✅ Tests for new features
- ✅ ESLint passes
- ✅ Documentation updated
- ✅ CI pipeline green

## 🌍 Browser Support

- ✅ **Chrome 88+** - Full support
- ✅ **Edge** - Chromium-based versions  
- ✅ **Brave** - All recent versions
- ✅ **Opera** - Chromium-based versions

## 🔒 Privacy First

Your privacy matters! 🛡️ Here's our promise:

- ✅ **100% Local** - All analysis happens in your browser
- ✅ **Zero Tracking** - We don't know what sites you visit
- ✅ **No Data Collection** - Nothing leaves your device
- ✅ **Settings Only** - We only store your zoom preferences
- ✅ **Minimal Permissions** - Only what we absolutely need

## 💬 Support & Community

Need help? Have ideas? We're here for you! 

- 🐛 **Found a Bug?** → [Report it here](https://github.com/username/auto-text-zoom/issues/new?template=bug_report.md)
- 💡 **Got an Idea?** → [Share it with us](https://github.com/username/auto-text-zoom/issues/new?template=feature_request.md)
- 💬 **General Chat** → [Join Discussions](https://github.com/username/auto-text-zoom/discussions)
- 📖 **Documentation** → You're reading it! Plus inline code docs

## 📄 License

MIT License - Use it, modify it, share it! 🎉 

See [LICENSE](LICENSE) for the legal stuff.

## 🎯 Roadmap

Coming soon:
- 🎨 Custom themes for the settings panel
- 📊 Usage statistics and insights
- 🔄 More zoom transition effects
- 📱 Mobile browser support
- 🤖 AI-powered content detection

---

<div align="center">

**Made with ❤️ for people who value their eyesight**

⭐ **Love this extension?** Give us a star! It helps others discover it too.

</div>