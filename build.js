#!/usr/bin/env node
// Builds MarbleLuceFall.user.js from src/: the files listed in src/order.txt, joined in that order,
// nothing added or changed. The result is the one file Greasy Fork installs.
//   node build.js [output]      (default: MarbleLuceFall.user.js next to this file)
// No dependencies. The pieces are plain text cut from one script at its section boundaries; they share
// one scope (the userscript's IIFE), so the order in order.txt matters.
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, 'src');
const out = path.resolve(process.argv[2] || path.join(__dirname, 'MarbleLuceFall.user.js'));
const order = fs.readFileSync(path.join(SRC, 'order.txt'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const listed = new Set(order);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.relative(SRC, path.join(d, e.name))]);
const strays = walk(SRC).filter(f => f.endsWith('.js') && !listed.has(f.split(path.sep).join('/')));
if (strays.length) { console.error('Not in src/order.txt: ' + strays.join(', ')); process.exit(1); }
const text = order.map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
fs.writeFileSync(out, text);
const version = (text.match(/^\/\/ @version\s+(\S+)/m) || [])[1];
console.log(`MarbleLuceFall ${version}: ${order.length} files, ${text.split('\n').length - 1} lines -> ${out}`);
