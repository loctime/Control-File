import assert from 'node:assert/strict';

const { ControlFileClient } = await import('../dist/node/index.js');

const client = new ControlFileClient({
  baseUrl: 'https://api.example.com',
  getAuthToken: async () => 'token',
});

assert.ok(client.files);
assert.ok(client.folders);
assert.ok(client.shares);
assert.ok(client.users);
assert.ok(client.appFiles);
assert.equal(typeof client.appFiles.forApp, 'function');
