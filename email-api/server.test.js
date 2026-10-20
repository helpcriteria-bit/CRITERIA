const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

process.env.GMAIL_USER = 'sender@example.com';
process.env.GMAIL_APP_PASSWORD = 'test-password';
process.env.NOTIFICATION_EMAIL = 'owner@example.com';
process.env.CORS_ORIGINS = 'http://localhost:5501,https://criteriaa.web.app';

const { createServer } = require('./server');
const sentMessages = [];
const server = createServer({ sendMail: async message => sentMessages.push(message) });
let baseUrl;

before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
});

test('health endpoint responds without email credentials being used', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('rejects a browser origin outside the allowlist', async () => {
  const response = await fetch(`${baseUrl}/api/project-notification`, {
    method: 'POST',
    headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(response.status, 403);
});

test('rejects invalid project data without sending email', async () => {
  const response = await fetch(`${baseUrl}/api/project-notification`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5501', 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectTitle: 'No brief' })
  });
  assert.equal(response.status, 400);
  assert.equal(sentMessages.length, 0);
});

test('sends a valid brief only to the configured notification recipient', async () => {
  const project = {
    requestId: 'REQ-00001',
    projectTitle: 'Sample brand refresh',
    serviceLabel: 'Logo & Branding',
    clientName: 'Sample Client',
    clientEmail: 'client@example.com',
    description: 'A fresh visual identity for a small local coffee business.',
    country: 'IN',
    budgetCurrency: 'INR',
    budget: 1200,
    deadline: '2027-01-20',
    aiUsage: 85,
    attachments: [],
    recipient: 'attacker@example.com'
  };
  const response = await fetch(`${baseUrl}/api/project-notification`, {
    method: 'POST',
    headers: { Origin: 'https://criteriaa.web.app', 'Content-Type': 'application/json' },
    body: JSON.stringify(project)
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].to, 'owner@example.com');
  assert.match(sentMessages[0].text, /A fresh visual identity/);
});

test('honeypot requests are accepted without sending email', async () => {
  const response = await fetch(`${baseUrl}/api/project-notification`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5501', 'Content-Type': 'application/json' },
    body: JSON.stringify({ website: 'filled-by-bot' })
  });
  assert.equal(response.status, 202);
  assert.equal(sentMessages.length, 1);
});