const fs = require('fs');
const path = require('path');
const os = require('os');

const derivedDataDir = path.join(os.homedir(), 'Library/Developer/Xcode/DerivedData');
const spmBuildDir = path.join(__dirname, '../ios/App/CapApp-SPM/.build');

console.log('[clean-xcode] Cleaning Xcode caches...');

if (fs.existsSync(derivedDataDir)) {
  try {
    fs.readdirSync(derivedDataDir).forEach(file => {
      if (file.startsWith('App-')) {
        const fullPath = path.join(derivedDataDir, file);
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log('[clean-xcode] Removed DerivedData:', file);
      }
    });
  } catch (e) {
    console.error('[clean-xcode] Error removing DerivedData:', e);
  }
}

if (fs.existsSync(spmBuildDir)) {
  try {
    fs.rmSync(spmBuildDir, { recursive: true, force: true });
    console.log('[clean-xcode] Removed local SPM .build directory');
  } catch (e) {
    console.error('[clean-xcode] Error removing SPM .build:', e);
  }
}

console.log('[clean-xcode] Done! Xcode cache cleaned.');
