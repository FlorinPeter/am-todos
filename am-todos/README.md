# Agentic Markdown Todos

> **AI-Powered Todo Application** that transforms GitHub repositories into intelligent task management systems

Transform your GitHub repository into a smart todo system that merges the simplicity of plain text files with modern AI power. **You own your data** as markdown files in your Git repository.

## 🚀 **Quick Start**

### **Development Setup**
1. **Backend**: `cd server && node server.js` (port 3001)
2. **Frontend**: `npm start` (port 3000)  
3. **Configuration**: Complete the setup wizard in the application UI

### **Production Setup**
1. **Build**: `npm run build`
2. **Deploy**: Deploy `build/` folder and `server/` directory
3. **Configuration**: Users provide their own API keys through the UI

## ✨ **Key Features**

### **🧠 AI-Powered Task Generation**
- Enter high-level goals → Get detailed actionable checklists
- AI chat assistant for task modifications
- Smart commit message generation
- **User-owned API keys**: Each user provides their own Google Gemini API key

### **📱 Mobile-First Responsive Design**
- Optimized mobile interface with hamburger menu
- Touch-friendly interactions and responsive layouts
- Automatic title shortening for mobile screens

### **📂 Multi-Project Support**
- Organize tasks in custom project folders
- Switch between projects seamlessly
- Archive and active task separation

### **🔄 Git-Powered Workflow**
- Every change is a versioned commit
- Complete audit history with git integration
- Smart file naming: `2025-01-05-task-name.md`

### **📝 Interactive Markdown**
- Rich markdown editing with live preview
- Interactive checkboxes (click to toggle)
- Real-time GitHub synchronization

## 🎯 **Core Principles**

- **You Own Your Data**: Tasks stored as `.md` files in your GitHub repo
- **Git-Native**: Every action creates meaningful commits
- **AI as Partner**: Intelligent assistance without vendor lock-in
- **Markdown-First**: Universal format, editable anywhere

## 📱 **Mobile Experience**

- **Responsive Design**: Optimized for all screen sizes
- **Touch Interface**: Large touch targets and gesture-friendly
- **Hamburger Navigation**: Clean mobile sidebar experience
- **Shortened Titles**: "AM Todos" instead of full name on mobile
- **Icon-Based Actions**: Icons on mobile, text on desktop
- **Mobile Settings Access**: Dedicated settings gear (⚙️) button visible on mobile

## ⚙️ **Initial Setup**

### **Required API Keys**
1. **GitHub Personal Access Token (PAT)**:
   - Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
   - Create a **fine-grained personal access token**
   - Grant `Contents` read/write permissions to your todo repository
   - Copy the token (starts with `ghp_`)

2. **Google Gemini API Key**:
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a free API key
   - Copy the key (starts with `AIzaSy`)

### **Setup Wizard**
When you first open the application, you'll see the setup wizard:
1. **GitHub PAT**: Paste your GitHub token
2. **Gemini API Key**: Paste your Google AI key  
3. **Repository**: Enter your GitHub username and repository name
4. **Project Folder**: Choose or create a project folder (defaults to `todos`)

All settings are stored securely in your browser's localStorage.

### **Accessing Settings Later**
- **Desktop**: Click the gear icon (⚙️) in the top-right toolbar
- **Mobile**: Tap the gear icon (⚙️) next to the + button in the header
- **Settings Modal**: Full-screen responsive settings dialog with all configuration options

## 🛠 **Available Scripts**

### **Development**
```bash
npm start          # Frontend development server (localhost:3000)
npm test           # Run test suite in watch mode  
npm run build      # Production build
npm run test:basic # Quick feature validation (2-3 minutes)
```

### **Backend**
```bash
cd server && node server.js  # Start backend server (localhost:3001)
```

### **Testing**
```bash
npm run test:basic        # Feature validation tests
npm run test:github-basic # Real GitHub API integration tests
./restart.sh             # Restart both frontend and backend
```

## 📚 **Documentation**

- **[STYLE_GUIDE.md](STYLE_GUIDE.md)**: UI design standards and button consistency rules
- **[TESTING.md](TESTING.md)**: Comprehensive testing documentation (100% coverage)
- **[concept.md](concept.md)**: Application architecture and design philosophy

## 🔧 **Technical Architecture**

### **Three-Layer System**
1. **React Frontend**: TypeScript, TailwindCSS, Mobile-first design
2. **Express Backend**: AI API proxy, security layer  
3. **External Services**: GitHub API (storage) + Google Gemini (AI)

### **Mobile-First Design**
- **Responsive Breakpoints**: Mobile (320px+), Tablet (640px+), Desktop (1024px+)
- **Component Patterns**: Icon/text switching, collapsible panels
- **Touch Optimization**: 32px minimum touch targets

### **Key Technologies**
- **Frontend**: React 19.1.0, TypeScript, TailwindCSS 3.4.17
- **Backend**: Express 5.1.0, Google Gemini AI
- **Storage**: GitHub API with fine-grained PAT
- **Testing**: Jest with 100% feature coverage

## 🎨 **UI Standards**

All interactive elements follow consistent design patterns:
- **Standard Button Height**: `py-1.5 min-h-[32px] flex items-center justify-center`
- **Mobile Icons**: `w-4 h-4` SVG icons with proper responsive switching
- **Responsive Text**: `hidden sm:inline` for desktop, `sm:hidden` for mobile
- **Color System**: P1-P5 priority colors, semantic status colors

## 🚀 **Production Ready**

- ✅ **100% Test Coverage**: All features validated with comprehensive test suite
- ✅ **Mobile Optimized**: Touch-friendly interface with responsive design
- ✅ **Performance**: Sub-second operations, optimized for mobile networks
- ✅ **Security**: Fine-grained GitHub permissions, user-owned API keys
- ✅ **Accessibility**: Keyboard navigation, screen reader friendly

## 📞 **Support**

**Common Issues**:
- **Button styling**: See [STYLE_GUIDE.md](STYLE_GUIDE.md) for standardized patterns
- **Mobile layout**: Check responsive breakpoints and touch targets
- **Testing**: Run `npm run test:basic` for quick validation

**Development**:
- Built with Create React App (do not eject)
- TailwindCSS for styling with PostCSS configuration
- Jest testing framework with comprehensive mocking

## 📄 **License**

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

### **Apache 2.0 License**
- ✅ **Commercial Use**: Use in commercial projects
- ✅ **Modification**: Modify and distribute
- ✅ **Distribution**: Share and redistribute
- ✅ **Patent Grant**: Includes patent protection
- ⚠️ **Attribution Required**: Must include copyright notice

---

## Learn More About Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).