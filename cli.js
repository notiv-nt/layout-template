#!/usr/bin/env node

const spawn = require('cross-spawn');
const path = require('path');

const proc = spawn(path.resolve(__dirname, './node_modules/.bin/gulp'), [`--root=${process.cwd()}`, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: __dirname,
});
