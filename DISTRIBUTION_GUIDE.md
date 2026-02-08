# Bible Quizzing App - Distribution Guide

This guide explains how to share the Bible Quizzing app with others on Chromebook, Windows, and Mac.

## Quick Overview

The app is a **Progressive Web App (PWA)**, which means:
- ✅ Works in any modern browser (Chrome, Edge, Firefox, Safari)
- ✅ Can be "installed" as an app on any device
- ✅ Works offline once loaded
- ✅ No app store required
- ✅ Automatic updates when you deploy changes

## Distribution Options

### Option 1: Host on GitHub Pages (FREE - Recommended)

This is the easiest way to share with anyone. They just visit a URL.

#### Setup Steps:

1. **Create a GitHub repository** (if you don't have one)
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/bible-quizzing.git
   git push -u origin main
   ```

2. **Build for production**
   ```bash
   npm run build
   ```

3. **Deploy to GitHub Pages**

   Install the deployment tool:
   ```bash
   npm install -g angular-cli-ghpages
   ```

   Deploy:
   ```bash
   npx angular-cli-ghpages --dir=dist/bible-quizzing-angular/browser
   ```

4. **Share the URL**
   Your app will be available at:
   `https://YOUR_USERNAME.github.io/bible-quizzing/`

#### For Users:
1. Visit the URL in Chrome/Edge
2. Click the install icon (⊕) in the address bar
3. Click "Install"
4. The app appears on their desktop/home screen!

---

### Option 2: Host on Netlify (FREE)

Another easy option with automatic deployments.

1. Go to [netlify.com](https://netlify.com) and sign up
2. Drag and drop the `dist/bible-quizzing-angular/browser` folder
3. Get your free URL (e.g., `bible-quiz-app.netlify.app`)
4. Share the URL with users

---

### Option 3: Local File Sharing (USB/Network)

For offline distribution without internet hosting.

1. **Build the app**
   ```bash
   npm run build
   ```

2. **Copy the build folder**
   - The build output is in: `dist/bible-quizzing-angular/browser/`
   - Copy this entire folder to a USB drive or shared network folder

3. **Run locally**
   Users need a simple local server. Options:

   **Using Python (pre-installed on Mac/Linux):**
   ```bash
   cd bible-quizzing-angular
   python3 -m http.server 8080
   ```
   Then open: `http://localhost:8080`

   **Using Node.js:**
   ```bash
   npx serve dist/bible-quizzing-angular/browser
   ```

   **Using Chrome extension "Web Server for Chrome":**
   - Install from Chrome Web Store
   - Point to the browser folder
   - Access the app

---

### Option 4: Package as Desktop App (Advanced)

For users who want a traditional .exe/.app file.

**Using Electron:**
```bash
npm install electron electron-builder --save-dev
```

Then create `electron.js`:
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'dist/bible-quizzing-angular/browser/index.html'));
}

app.whenReady().then(createWindow);
```

Build for each platform:
- Windows: `npx electron-builder --win`
- Mac: `npx electron-builder --mac`
- Linux: `npx electron-builder --linux`

This creates installers in the `release` folder.

---

## How Users Install the PWA

### On Chromebook / Chrome:
1. Visit your app URL
2. Look for the **install icon** (⊕) in the address bar
3. Click "Install"
4. App appears in the app launcher!

### On Windows (Edge/Chrome):
1. Visit your app URL
2. Click the **three dots menu** (⋮)
3. Select "Install XL Bible Quizzing"
4. App appears on desktop and Start menu!

### On Mac (Chrome/Safari):
1. Visit your app URL
2. Click the **share icon** or install prompt
3. Select "Add to Dock" or "Install"
4. App appears in Launchpad!

### On iOS/Android:
1. Visit your app URL in browser
2. Tap **Share** button
3. Select "Add to Home Screen"
4. App icon appears on home screen!

---

## Offline Support

The app includes a **Service Worker** that caches:
- All application code (HTML, CSS, JS)
- All icons and images
- All dataset JSON files (after first load)

**First Time:**
1. User visits the app online
2. Clicks "Import All Datasets" to load quiz data
3. Service worker caches everything

**After That:**
- App works completely offline!
- Data is stored in IndexedDB (browser's local database)
- No internet required to run quizzes

---

## Updating the App

### For You (Developer):
1. Make changes to the code
2. Run `npm run build`
3. Deploy to your hosting (GitHub Pages, Netlify, etc.)

### For Users:
- PWA automatically checks for updates when online
- New version downloads in background
- User sees update on next app launch
- No manual update required!

---

## Sharing Specific Data

### Export Data from One Computer:
1. Go to Database Explorer
2. Click on a table
3. Click "Export JSON"
4. Save the file

### Import Data on Another Computer:
1. Go to Data Import
2. Select the JSON file
3. Data is merged into their database

### Share Quiz Sets:
The quiz set data is included in the dataset JSON files. Users who load the same datasets will have the same quiz sets available.

---

## Technical Requirements

### Minimum Browser Versions:
- Chrome 60+
- Edge 79+
- Firefox 65+
- Safari 11.1+

### Chromebook:
- Any Chromebook with Chrome browser ✅

### Windows:
- Windows 10 or later ✅
- Chrome, Edge, or Firefox

### Mac:
- macOS 10.13 or later ✅
- Chrome, Safari, or Firefox

### Storage:
- ~50MB for app + datasets
- Stored in browser's IndexedDB

---

## Troubleshooting

### "Install" button not showing?
- Make sure you're using HTTPS (or localhost)
- Try refreshing the page
- Check if PWA is already installed

### App not working offline?
- Make sure to load datasets while online first
- Check browser's "Application" tab in DevTools
- Clear cache and reload if needed

### Data not syncing between devices?
- This is a local-first app (no cloud sync)
- Use Export/Import to transfer data manually
- Consider adding a shared database if needed

---

## Summary

**Easiest for most users:**
1. Deploy to GitHub Pages or Netlify (free)
2. Share the URL
3. Users click "Install" in their browser
4. Done! Works on Chromebook, Windows, Mac, and mobile

**No hosting? No problem:**
1. Copy the `dist/bible-quizzing-angular/browser` folder
2. Share via USB or network
3. Users run with a simple local server
4. Works completely offline!

The PWA approach gives you the best of both worlds: easy web distribution plus native app-like experience, without the complexity of app stores or platform-specific builds.
