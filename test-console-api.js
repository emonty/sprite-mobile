#!/usr/bin/env node

/**
 * Test script for Sprite Console WebSocket API
 * Usage: node test-console-api.js <sprite-name> <api-key>
 */

const WebSocket = require('ws');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node test-console-api.js <sprite-name> <api-key>');
  console.error('Example: node test-console-api.js my-sprite sk_test_12345');
  process.exit(1);
}

const [spriteName, apiKey] = args;
const wsUrl = `ws://localhost:8081/api/sprites/${spriteName}/console`;

// Validate API key format
if (!apiKey.startsWith('sk_') && !apiKey.startsWith('rk_')) {
  console.error('Error: API key must start with "sk_" or "rk_"');
  process.exit(1);
}

console.log(`Connecting to: ${wsUrl}`);
console.log(`Sprite: ${spriteName}`);
console.log(`API Key: ${apiKey.substring(0, 10)}...`);
console.log('---');

// Create WebSocket with authentication
const credentials = Buffer.from(`${apiKey}:x`).toString('base64');
const ws = new WebSocket(wsUrl, {
  headers: {
    'Authorization': `Basic ${credentials}`
  }
});

ws.on('open', () => {
  console.log('✓ Connected to sprite console');
  console.log('---');

  // Send a test command
  setTimeout(() => {
    console.log('> Sending command: whoami');
    ws.send('whoami\n');
  }, 500);

  // Send another command
  setTimeout(() => {
    console.log('> Sending command: pwd');
    ws.send('pwd\n');
  }, 1500);

  // Send exit command
  setTimeout(() => {
    console.log('> Sending command: exit');
    ws.send('exit\n');
  }, 2500);
});

ws.on('message', (data) => {
  // Print console output
  const output = data.toString();
  process.stdout.write(output);
});

ws.on('close', (code, reason) => {
  console.log('---');
  console.log(`✓ Disconnected from sprite console (code: ${code}, reason: ${reason || 'none'})`);
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('✗ WebSocket error:', error.message);
  process.exit(1);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n---');
  console.log('Closing connection...');
  ws.close();
});
