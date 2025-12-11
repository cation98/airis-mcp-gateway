#!/usr/bin/env node

// Import the compiled CLI
import('../dist/index.js').catch(err => {
  console.error('Failed to load AIRIS Gateway CLI:', err);
  process.exit(1);
});
