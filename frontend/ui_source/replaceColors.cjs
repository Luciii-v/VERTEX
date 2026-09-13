const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('g:/Vertex/src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Backgrounds
    content = content.replace(/bg-\[#0a0a0f\]\/?\d*/g, 'bg-base');
    content = content.replace(/bg-\[#12121a\]\/?\d*/g, 'bg-panel');
    content = content.replace(/bg-\[#1a140e\]/g, 'bg-panel');
    content = content.replace(/bg-\[#050508\]/g, 'bg-base');
    content = content.replace(/bg-\[#00ff88\]/g, 'bg-textPrimary');
    content = content.replace(/bg-\[#00d4ff\]/g, 'bg-textPrimary');
    content = content.replace(/bg-\[#ff00ff\]/g, 'bg-textPrimary');
    content = content.replace(/bg-\[#ffaa00\]/g, 'bg-accent');
    content = content.replace(/bg-\[#ff3333\]/g, 'bg-error');

    // Translucent background tints (remove tint, use base)
    content = content.replace(/bg-\[#[0-9a-fA-F]{6}\]\/\d+/g, 'bg-base');
    content = content.replace(/bg-white\/\d+/g, 'bg-base');
    
    // Borders
    content = content.replace(/border-\[#[0-9a-fA-F]{6}\]\/\d+/g, 'border-border');
    content = content.replace(/border-\[#[0-9a-fA-F]{6}\]/g, 'border-border');
    content = content.replace(/border-white\/\d+/g, 'border-border');
    
    // Text colors
    content = content.replace(/text-\[#00ff88\]/g, 'text-textPrimary');
    content = content.replace(/text-\[#00d4ff\]/g, 'text-textPrimary');
    content = content.replace(/text-\[#ff00ff\]/g, 'text-textPrimary');
    content = content.replace(/text-\[#ffaa00\]/g, 'text-accent');
    content = content.replace(/text-\[#ff3333\]/g, 'text-error');
    content = content.replace(/text-white\/\d+/g, 'text-textSecondary');
    content = content.replace(/text-white/g, 'text-textPrimary');

    // Glows and blurs
    content = content.replace(/text-glow-[a-z]+/g, '');
    content = content.replace(/shadow-glow-[a-z]+/g, '');
    content = content.replace(/backdrop-blur-[a-z]+/g, '');
    
    // Other cleanups
    content = content.replace(/from-\[#[0-9a-fA-F]{6}\]/g, 'from-border');
    content = content.replace(/to-\[#[0-9a-fA-F]{6}\]/g, 'to-textPrimary');
    content = content.replace(/via-\[#[0-9a-fA-F]{6}\]/g, '');
    
    fs.writeFileSync(filePath, content, 'utf8');
  }
});
console.log("Color replacement complete.");
