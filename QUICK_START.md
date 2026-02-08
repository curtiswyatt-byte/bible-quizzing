# Quick Start Guide

## Important: Correct Directory

The project is located at:
```
/Users/curtiswyatt/QuizProgramCodeFiles/bible-quizzing-angular
```

**Not** in:
```
~/Library/Mobile Documents/com~apple~CloudDocs/XL Applications/Original Bible Quizzing/bible-quizzing-angular
```

## To Run the Application

1. **Navigate to the correct directory:**
   ```bash
   cd /Users/curtiswyatt/QuizProgramCodeFiles/bible-quizzing-angular
   ```

2. **Install dependencies (if not already done):**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   Navigate to `http://localhost:4200`

## Creating a Shortcut

To make it easier, you can create an alias in your shell profile:

```bash
# Add to ~/.zshrc or ~/.bash_profile
alias quizapp='cd /Users/curtiswyatt/QuizProgramCodeFiles/bible-quizzing-angular && npm start'
```

Then you can just type `quizapp` to start the application.

## Troubleshooting

### "Cannot find package.json"
- Make sure you're in the correct directory
- Run `pwd` to check your current location
- The directory should contain `package.json`, `angular.json`, and `src/` folder

### Port already in use
- The default port is 4200
- If needed, you can change it: `npm start -- --port 4201`

### Database errors
- Check browser console for IndexedDB errors
- Make sure your browser supports IndexedDB
- Try clearing browser cache and reloading

## Current Status

✅ Database layer - Complete
✅ Main menu - Complete  
✅ Player entry - Complete
⚠️ Other components - Need implementation

See `PROJECT_SUMMARY.md` for details.





