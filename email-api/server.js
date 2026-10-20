const http = require('node:http');
const nodemailer = require('nodemailer');

const PORT = Number(process.env.PORT || 3001);
const MAX_BODY_BYTES = 32 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || 'http://localhost:5501,http://127.0.0.1:5501,https://criteriaa.web.app')
    .split(',').map(origin => origin.trim()).filter(Boolean)
);
const rateLimits = new Map();
const allowedServices = new Set([
  'Poster & Graphics', 'Logo & Branding', 'Thumbnails', 'Websites',
  'Video Editing', 'UI/Presentations', 'UI / Presentations'
]);
const allowedCountries = new Set(['IN', 'US', 'GB', 'EU', 'AU', 'CA', 'AED', 'SAR', 'QAR', 'KWD', 'OTHER']);
const allowedCurrencies = new Set(['INR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD', 'AED', 'SAR', 'QAR', 'KWD']);

const gmailUser = (process.env.GMAIL_USER || '').trim();
const gmailPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
const notificationEmail = (process.env.NOTIFICATION_EMAIL || '').trim();

if (!gmailUser || !gmailPassword || !notificationEmail) {
  console.error('Set GMAIL_USER, GMAIL_APP_PASSWORD, and NOTIFICATION_EMAIL before starting the email API.');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: gmailUser, pass: gmailPassword }
});

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(body));
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (!origin || !allowedOrigins.has(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}

function isRateLimited(ip) {
  const now = Date.now();
  const current = rateLimits.get(ip);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateLimits.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  current.count++;
  return current.count > RATE_LIMIT;
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      const error = new Error('request_too_large');
      error.status = 413;
      throw error;
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('invalid_json');
    error.status = 400;
    throw error;
  }
}

function requiredText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

    const projectTitle = requiredText(input.projectTitle);
    const serviceLabel = requiredText(input.serviceLabel);
    const clientName = requiredText(input.clientName);
    const clientEmail = requiredText(input.clientEmail);
    const description = requiredText(input.description);
    const requestId = requiredText(input.requestId);
    const deadline = requiredText(input.deadline);
    const country = requiredText(input.country);
    const budgetCurrency = requiredText(input.budgetCurrency);
  const aiUsage = Number(input.aiUsage);
  const budget = input.budget == null ? null : Number(input.budget);
    const parsedDeadline = new Date(`${deadline}T00:00:00Z`);

    if (projectTitle.length < 4 || projectTitle.length > 80 || !allowedServices.has(serviceLabel) ||
      !clientName || clientName.length > 120 || !validEmail(clientEmail) ||
      description.length < 20 || description.length > 2000 || !requestId || requestId.length > 80 ||
      !allowedCountries.has(country) || !allowedCurrencies.has(budgetCurrency) ||
      !Number.isInteger(aiUsage) || aiUsage < 15 || aiUsage > 100 || aiUsage % 5 !== 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
      Number.isNaN(parsedDeadline.getTime()) || parsedDeadline.toISOString().slice(0, 10) !== deadline ||
      (budget !== null && (!Number.isFinite(budget) || budget < 1 || budget > 100000000))) {
    return null;
  }

  const attachments = input.attachments == null ? [] : input.attachments;
  if (!Array.isArray(attachments) || attachments.length > 20) return null;
  const safeAttachments = [];
  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== 'object') return null;
    const name = requiredText(attachment.name);
    try {
      const url = new URL(attachment.url);
      if (!name || name.length > 180 || url.protocol !== 'https:' ||
          url.hostname !== 'res.cloudinary.com' || url.username || url.password) return null;
      safeAttachments.push({ name, url: url.href });
    } catch {
      return null;
    }
  }

  return {
    requestId,
    projectTitle,
    serviceLabel,
    clientName,
    clientEmail,
    description,
    country,
    budgetCurrency,
    budget,
    deadline,
    aiUsage,
    attachments: safeAttachments
  };
}

function createEmailText(project) {
  const budget = project.budget == null
    ? 'Not specified'
    : `${project.budgetCurrency} ${project.budget.toLocaleString('en-US')}`;
  const attachments = project.attachments.length
    ? project.attachments.map(file => `- ${file.name}: ${file.url}`).join('\n')
    : 'None';

  return [
    `Project: ${project.projectTitle}`,
    `Request ID: ${project.requestId}`,
    `Type: ${project.serviceLabel}`,
    `Client: ${project.clientName}`,
    `Client email: ${project.clientEmail}`,
    `Country: ${project.country}`,
    `Budget: ${budget}`,
    `Deadline: ${project.deadline}`,
    `AI usage: ${project.aiUsage}%`,
    '',
    'Project brief:',
    project.description,
    '',
    'Attachments:',
    attachments
  ].join('\n');
}

function createServer(mailTransport = transporter) {
  return http.createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    return sendJson(res, 200, { status: 'ok' });
  }

  const corsAllowed = applyCors(req, res);
  if (req.method === 'OPTIONS') {
    if (!corsAllowed) return sendJson(res, 403, { error: 'origin_not_allowed' });
    res.writeHead(204);
    return res.end();
  }
  if (req.url !== '/api/project-notification' || req.method !== 'POST') {
    return sendJson(res, 404, { error: 'not_found' });
  }
  if (!corsAllowed) return sendJson(res, 403, { error: 'origin_not_allowed' });
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
    return sendJson(res, 415, { error: 'content_type_must_be_json' });
  }

  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  if (isRateLimited(clientIp)) return sendJson(res, 429, { error: 'rate_limit_exceeded' });

  try {
    const input = await readJson(req);
    if (requiredText(input?.website)) return sendJson(res, 202, { success: true });
    const project = validateSubmission(input);
    if (!project) return sendJson(res, 400, { error: 'invalid_project_details' });

    const subjectTitle = project.projectTitle.replace(/[\r\n]+/g, ' ').slice(0, 80);
    await mailTransport.sendMail({
      from: `CRITERIA Project Notifications <${gmailUser}>`,
      to: notificationEmail,
      subject: `New project submission: ${subjectTitle}`,
      text: createEmailText(project)
    });
    return sendJson(res, 200, { success: true });
  } catch (error) {
    if (error.status) return sendJson(res, error.status, { error: error.message });
    console.error('Project notification email failed:', error.message);
    return sendJson(res, 502, { error: 'email_delivery_failed' });
  }
  });
}

if (require.main === module) {
  createServer().listen(PORT, '0.0.0.0', () => {
    console.log(`CRITERIA email API listening on port ${PORT}`);
  });
}

module.exports = { createServer };