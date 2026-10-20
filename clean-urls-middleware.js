const fs = require('fs');
const path = require('path');

function findHtmlFile(relName, rootDir) {
  const root = (typeof rootDir === 'string' && rootDir) ? rootDir : process.cwd();
  let clean = (relName || '').replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.html$/i, '');

  if (!clean || clean.toLowerCase() === 'index') {
    const rootIndexCandidates = [
      path.join(root, 'index.html'),
      path.join(root, 'public', 'index.html'),
      path.join(root, 'C', 'public', 'index.html')
    ];
    for (const cand of rootIndexCandidates) {
      try {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
      } catch (e) {}
    }
  }

  // Strip prefixes like 'public/' or 'c/public/' or 'c/' if present
  clean = clean.replace(/^(?:c\/public\/|c\/|public\/)/i, '');
  const baseName = path.basename(clean);

  if (clean.toLowerCase() === 'auth/callback') {
    const directAuthCb = path.join(root, 'auth', 'callback.html');
    try {
      if (fs.existsSync(directAuthCb) && fs.statSync(directAuthCb).isFile()) return directAuthCb;
    } catch (e) {}
  }

  const candidates = [
    path.join(root, clean + '.html'),
    path.join(root, 'public', clean + '.html'),
    path.join(root, 'C', 'public', clean + '.html'),
    path.join(root, clean, 'index.html'),
    path.join(root, 'public', clean, 'index.html'),
    path.join(root, 'C', 'public', clean, 'index.html'),
    path.join(root, clean, baseName + '.html'),
    path.join(root, 'public', clean, baseName + '.html'),
    path.join(root, 'C', 'public', clean, baseName + '.html')
  ];

  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return cand;
      }
    } catch (e) {}
  }
  return null;
}

function findStaticFile(relPath, rootDir) {
  const root = (typeof rootDir === 'string' && rootDir) ? rootDir : process.cwd();
  let clean = (relPath || '').replace(/^\/+/, '').replace(/\/+$/, '');
  clean = clean.replace(/^(?:c\/public\/|c\/|public\/)/i, '');

  const candidates = [
    path.join(root, clean),
    path.join(root, 'public', clean),
    path.join(root, 'C', 'public', clean)
  ];

  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return cand;
      }
    } catch (e) {}
  }
  return null;
}


const https = require('https');

function getGitHubSecret(root) {
  if (process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_CLIENT_SECRET.trim()) {
    return process.env.GITHUB_CLIENT_SECRET.trim();
  }
  const secretPath = path.join(root, 'github-secret.json');
  if (fs.existsSync(secretPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
      if (data.client_secret) return data.client_secret.trim();
    } catch(e) {}
  }
  const envPath = path.join(root, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envText = fs.readFileSync(envPath, 'utf8');
      const m = envText.match(/^GITHUB_CLIENT_SECRET=(.+)$/m);
      if (m && m[1]) return m[1].trim();
    } catch(e) {}
  }
  return null;
}

function saveGitHubSecret(root, secret) {
  try {
    const secretPath = path.join(root, 'github-secret.json');
    fs.writeFileSync(secretPath, JSON.stringify({ client_secret: secret.trim(), updatedAt: new Date().toISOString() }, null, 2), 'utf8');
    process.env.GITHUB_CLIENT_SECRET = secret.trim();
    return true;
  } catch(e) {
    return false;
  }
}

function httpsRequestJson(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', err => reject(err));
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });
}

async function handleGitHubApi(req, res, pathname, root) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  await new Promise(r => req.on('end', r));
  let payload = {};
  try { if (body) payload = JSON.parse(body); } catch(e) {}

  if (pathname === '/api/github/status') {
    const secret = getGitHubSecret(root);
    res.writeHead(200);
    return res.end(JSON.stringify({ success: true, hasSecret: Boolean(secret), clientId: 'Ov23lipAqIXEmEEgbZk3' }));
  }

  if (pathname === '/api/github/save-secret') {
    if (payload.client_secret) {
      saveGitHubSecret(root, payload.client_secret);
      res.writeHead(200);
      return res.end(JSON.stringify({ success: true }));
    }
    res.writeHead(400);
    return res.end(JSON.stringify({ success: false, error: 'missing_secret' }));
  }

  if (pathname === '/api/github/verify-user') {
    const username = (payload.username || '').trim().replace(/^@/, '');
    if (!username) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'username_required' }));
    }
    try {
      const resp = await httpsRequestJson({
        hostname: 'api.github.com',
        path: '/users/' + encodeURIComponent(username),
        method: 'GET',
        headers: { 'User-Agent': 'Criteria-Web', 'Accept': 'application/vnd.github.v3+json' }
      });
      if (resp.status === 200 && resp.data) {
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: true,
          username: resp.data.login,
          name: resp.data.name || resp.data.login,
          avatar: resp.data.avatar_url,
          html_url: resp.data.html_url
        }));
      } else {
        res.writeHead(404);
        return res.end(JSON.stringify({ success: false, error: 'user_not_found' }));
      }
    } catch(err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  if (pathname === '/api/github/token') {
    const code = (payload.code || '').trim();
    if (!code) {
      res.writeHead(400);
      return res.end(JSON.stringify({ success: false, error: 'code_required' }));
    }

    if (payload.client_secret) {
      saveGitHubSecret(root, payload.client_secret);
    }
    const secret = getGitHubSecret(root);
    if (!secret) {
      res.writeHead(200);
      return res.end(JSON.stringify({
        success: false,
        error: 'missing_client_secret',
        clientId: 'Ov23lipAqIXEmEEgbZk3',
        message: 'GitHub Client Secret needed to exchange token.'
      }));
    }

    try {
      // 1. Exchange code for access_token with GitHub
      const tokenResp = await httpsRequestJson({
        hostname: 'github.com',
        path: '/login/oauth/access_token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Criteria-Web'
        }
      }, {
        client_id: 'Ov23lipAqIXEmEEgbZk3',
        client_secret: secret,
        code: code
      });

      const tokenData = tokenResp.data || {};
      if (tokenData.error) {
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: false,
          error: tokenData.error,
          error_description: tokenData.error_description || tokenData.error
        }));
      }

      const accessToken = tokenData.access_token;
      if (!accessToken) {
        res.writeHead(200);
        return res.end(JSON.stringify({ success: false, error: 'no_access_token' }));
      }

      // 2. Fetch authenticated user profile
      const userResp = await httpsRequestJson({
        hostname: 'api.github.com',
        path: '/user',
        method: 'GET',
        headers: {
          'User-Agent': 'Criteria-Web',
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': 'token ' + accessToken
        }
      });

      const user = userResp.data || {};

      // 3. Fetch user repositories (public + private accessible by token)
      let repos = [];
      try {
        const repoResp = await httpsRequestJson({
          hostname: 'api.github.com',
          path: '/user/repos?sort=updated&per_page=30',
          method: 'GET',
          headers: {
            'User-Agent': 'Criteria-Web',
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': 'token ' + accessToken
          }
        });
        if (Array.isArray(repoResp.data)) {
          repos = repoResp.data.map(r => ({
            name: r.name,
            fullName: r.full_name,
            desc: r.description || 'GitHub Repository',
            updated: 'Updated ' + (r.updated_at ? new Date(r.updated_at).toLocaleDateString() : 'recently'),
            url: r.html_url,
            isPrivate: r.private
          }));
        }
      } catch(e) {}

      res.writeHead(200);
      return res.end(JSON.stringify({
        success: true,
        username: user.login,
        name: user.name || user.login,
        avatar: user.avatar_url,
        html_url: user.html_url,
        repos: repos
      }));
    } catch(err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  res.writeHead(404);
  return res.end(JSON.stringify({ error: 'not_found' }));
}


async function handleProjectNotificationApi(req, res, root) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  await new Promise(r => req.on('end', r));
  let project = {};
  try { if (body) project = JSON.parse(body); } catch(e) {}

  const requestId = project.requestId || 'REQ-' + Date.now();
  const projectTitle = project.projectTitle || project.name || 'Untitled Project';
  const serviceLabel = project.serviceLabel || project.category || 'Creative Project';
  const clientName = project.clientName || 'Valued Client';
  const clientEmail = project.clientEmail || 'Not provided';
  const description = project.description || 'No description provided.';
  const country = project.country || 'Global';
  const budgetCurrency = project.budgetCurrency || 'INR';
  const budget = project.budget != null ? `${budgetCurrency} ${Number(project.budget).toLocaleString('en-IN')}` : 'To be discussed';
  const deadline = project.deadline || 'Flexible';
  const aiUsage = project.aiUsage != null ? `${project.aiUsage}%` : 'Standard';
  const dateSent = project.dateSent || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });
  const attachments = Array.isArray(project.attachments) ? project.attachments : [];

  const recipientList = ['mhpk2010@gmail.com', 'help.criteria@gmail.com'];

  const plainText = [
    '========================================================',
    'CRITERIA STUDIO — NEW PROJECT SUBMISSION',
    '========================================================',
    `Date Sent:        ${dateSent}`,
    `Project Name:     ${projectTitle}`,
    `Request ID:       ${requestId}`,
    `Service Category: ${serviceLabel}`,
    `Client Name:      ${clientName}`,
    `Client Email:     ${clientEmail}`,
    `Country/Region:   ${country}`,
    `Agreed Budget:    ${budget}`,
    `Target Deadline:  ${deadline}`,
    `AI Tolerance:     ${aiUsage}`,
    '',
    '--------------------------------------------------------',
    'PROJECT BRIEF & SPECIFICATIONS',
    '--------------------------------------------------------',
    description,
    '',
    '--------------------------------------------------------',
    'ATTACHMENTS & REFERENCES',
    '--------------------------------------------------------',
    attachments.length ? attachments.map(a => `• ${a.name || 'Attachment'}: ${a.url || a}`).join('\n') : 'No attachments provided.',
    '========================================================'
  ].join('\n');

  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080808; color: #f5f5f5; margin: 0; padding: 24px; }
      .card { background-color: #121216; border: 1px solid rgba(240, 165, 0, 0.25); border-radius: 14px; max-width: 600px; margin: 0 auto; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.7); }
      .header { background: linear-gradient(135deg, #1c1a14 0%, #121216 100%); border-bottom: 1px solid rgba(240, 165, 0, 0.2); padding: 24px; }
      .badge { display: inline-block; background: rgba(240, 165, 0, 0.15); border: 1px solid rgba(240, 165, 0, 0.35); color: #f0a500; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 4px 10px; border-radius: 100px; margin-bottom: 12px; }
      .title { font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 6px 0; letter-spacing: -0.02em; }
      .sub { font-size: 13px; color: #888899; margin: 0; }
      .body { padding: 24px; }
      .grid { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      .grid td { padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.06); font-size: 13px; vertical-align: top; }
      .label { color: #888899; width: 38%; font-weight: 500; }
      .val { color: #ffffff; font-weight: 600; }
      .val.gold { color: #f0a500; font-weight: 700; font-size: 14px; }
      .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #f0a500; margin: 20px 0 8px 0; }
      .brief-box { background: #08080a; border: 1px solid rgba(255, 255, 255, 0.08); border-left: 3px solid #f0a500; padding: 14px 16px; border-radius: 6px; font-size: 13px; line-height: 1.6; color: #dddddd; white-space: pre-wrap; }
      .files-list { list-style: none; padding: 0; margin: 8px 0 0 0; }
      .files-list li { margin-bottom: 6px; font-size: 12px; }
      .files-list a { color: #f0a500; text-decoration: none; }
      .footer { background: #0a0a0c; border-top: 1px solid rgba(255, 255, 255, 0.06); padding: 16px 24px; text-align: center; font-size: 11px; color: #666677; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <div class="badge">New Client Project</div>
        <h1 class="title">${projectTitle}</h1>
        <p class="sub">Request ID: <strong>${requestId}</strong> &bull; Sent on: ${dateSent}</p>
      </div>
      <div class="body">
        <table class="grid">
          <tr><td class="label">Client Name</td><td class="val">${clientName}</td></tr>
          <tr><td class="label">Client Email</td><td class="val"><a href="mailto:${clientEmail}" style="color:#f0a500;text-decoration:none;">${clientEmail}</a></td></tr>
          <tr><td class="label">Service Category</td><td class="val">${serviceLabel}</td></tr>
          <tr><td class="label">Agreed Budget</td><td class="val gold">${budget}</td></tr>
          <tr><td class="label">Target Deadline</td><td class="val">${deadline}</td></tr>
          <tr><td class="label">Country / Region</td><td class="val">${country}</td></tr>
          <tr><td class="label">AI Usage Tolerance</td><td class="val">${aiUsage}</td></tr>
        </table>

        <div class="section-label">Project Brief & Specifications</div>
        <div class="brief-box">${description}</div>

        <div class="section-label">Attachments (${attachments.length})</div>
        ${attachments.length ? `
          <ul class="files-list">
            ${attachments.map(a => `<li>&bull; <a href="${a.url || a}" target="_blank">${a.name || 'View Attachment'}</a></li>`).join('')}
          </ul>
        ` : '<p style="font-size:12px;color:#777;margin:4px 0;">No attachments uploaded.</p>'}
      </div>
      <div class="footer">
        CRITERIA Studio &bull; Automated Client Submission Notification
      </div>
    </div>
  </body>
  </html>
  `;

  let gmailUser = 'mhpk2010@gmail.com';
  let gmailPass = 'bwxrnorysaeulxxe';
  const emailEnvPath = path.join(root, 'email-api', '.env');
  if (fs.existsSync(emailEnvPath)) {
    try {
      const envText = fs.readFileSync(emailEnvPath, 'utf8');
      const uMatch = envText.match(/^GMAIL_USER=(.+)$/m);
      const pMatch = envText.match(/^GMAIL_APP_PASSWORD=(.+)$/m);
      if (uMatch && uMatch[1]) gmailUser = uMatch[1].trim();
      if (pMatch && pMatch[1]) gmailPass = pMatch[1].replace(/\s/g, '').trim();
    } catch(e) {}
  }

  let emailSent = false;
  let emailError = null;

  try {
    let nodemailer;
    try {
      nodemailer = require(path.join(root, 'email-api', 'node_modules', 'nodemailer'));
    } catch(e) {
      nodemailer = require('nodemailer');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass }
    });

    await transporter.sendMail({
      from: `"CRITERIA Studio" <${gmailUser}>`,
      to: recipientList.join(', '),
      subject: `[CRITERIA] New Project: ${projectTitle} (${requestId})`,
      text: plainText,
      html: htmlContent
    });
    emailSent = true;
    console.log(`[EMAIL] Project notification sent successfully to: ${recipientList.join(', ')}`);
  } catch(err) {
    emailError = err.message;
    console.warn('[EMAIL] Nodemailer sending encountered error:', err.message);
  }

  res.writeHead(200);
  return res.end(JSON.stringify({
    success: true,
    emailSent: emailSent,
    recipients: recipientList,
    requestId: requestId,
    dateSent: dateSent,
    error: emailError
  }));
}

function handleCleanUrls(req, res, next, rootDir) {
  const root = (typeof rootDir === "string" && rootDir) ? rootDir : process.cwd();
  const rawUrl = req.url || "/";
  const qIndex = rawUrl.indexOf("?");
  const pathname = qIndex !== -1 ? rawUrl.substring(0, qIndex) : rawUrl;
  if (pathname === '/api/project-notification') {
    return handleProjectNotificationApi(req, res, root);
  }
  if (pathname.startsWith("/api/github/")) {
    return handleGitHubApi(req, res, pathname, root);
  }

  try {
    // Prevent stale caching of static files and HTML during development
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    const root = (typeof rootDir === 'string' && rootDir) ? rootDir : process.cwd();
    const rawUrl = req.url || '/';
    const qIndex = rawUrl.indexOf('?');
    const pathname = qIndex !== -1 ? rawUrl.substring(0, qIndex) : rawUrl;
    const search = qIndex !== -1 ? rawUrl.substring(qIndex) : '';

    let decoded = decodeURIComponent(pathname);

    // If browser navigates directly to a .js file as a document (e.g. /ai-chat.js when Go Live is clicked with a JS file active in VS Code),
    // redirect to the website home instead of displaying raw code in the browser.
    const isDocNavigation = Boolean(
      req.headers && (
        req.headers['sec-fetch-dest'] === 'document' ||
        req.headers['sec-fetch-mode'] === 'navigate' ||
        (typeof req.headers.accept === 'string' && req.headers.accept.includes('text/html') && req.headers['sec-fetch-dest'] !== 'script' && req.headers['sec-fetch-dest'] !== 'style')
      )
    );

    if (isDocNavigation && pathname.toLowerCase().endsWith('.js')) {
      res.writeHead(302, { 'Location': '/' + search });
      return res.end();
    }

    // 1. Root route / -> serve index.html directly without redirect
    if (decoded === '/' || decoded === '' || decoded.toLowerCase() === '/index' || decoded.toLowerCase() === '/index.html') {
      const indexFile = findHtmlFile('index', root);
      if (indexFile) {
        req.url = '/' + path.relative(root, indexFile).replace(/\\/g, '/').replace(/^\/+/, '') + search;
      } else {
        req.url = '/index.html' + search;
      }
      return next();
    }

    // 2. Strip /C/public, /public, /c/ prefixes if present and redirect browser if needed
    let normalized = decoded.replace(/^\/+/, '');
    if (/^(?:c\/public\/|c\/|public\/)/i.test(normalized)) {
      const stripped = normalized.replace(/^(?:c\/public\/|c\/|public\/)/i, '');
      if (isDocNavigation) {
        res.writeHead(302, { 'Location': '/' + stripped + search });
        return res.end();
      }
      normalized = stripped;
    }

    const ext = path.extname(normalized).toLowerCase();

    // 3. Direct HTML file request (e.g. /agent.html, /critspace.html, /submit.html, /dashboard.html, /auth/callback.html)
    if (ext === '.html') {
      const htmlFile = findHtmlFile(normalized, root);
      if (htmlFile) {
        req.url = '/' + path.relative(root, htmlFile).replace(/\\/g, '/').replace(/^\/+/, '') + search;
      }
      return next();
    }

    // 4. Clean URL request without extension (e.g. /agent, /submit, /critspace, /dashboard, /profile, /settings, /admin, /admin-login, /callback, /auth/callback)
    if (!ext) {
      const htmlFile = findHtmlFile(normalized, root);
      if (htmlFile) {
        req.url = '/' + path.relative(root, htmlFile).replace(/\\/g, '/').replace(/^\/+/, '') + search;
        return next();
      }
    }

    // 5. Static assets with extensions (.css, .js, .png, .jpg, .svg, .woff2, etc.)
    if (ext) {
      const staticFile = findStaticFile(normalized, root);
      if (staticFile) {
        req.url = '/' + path.relative(root, staticFile).replace(/\\/g, '/').replace(/^\/+/, '') + search;
      }
      return next();
    }
  } catch (err) {
    console.error('clean-urls middleware error:', err);
  }
  next();
}

/**
 * Universal middleware export:
 * - Direct Connect middleware: app.use(cleanUrlsMiddleware)
 * - Factory function: cleanUrlsMiddleware(rootDir)
 */
function cleanUrlsMiddleware(reqOrRootDir, res, next) {
  if (res && typeof next === 'function') {
    return handleCleanUrls(reqOrRootDir, res, next, process.cwd());
  }

  const configuredRoot = (typeof reqOrRootDir === 'string' && reqOrRootDir) ? reqOrRootDir : process.cwd();
  return function(req, res, next) {
    return handleCleanUrls(req, res, next, configuredRoot);
  };
}

module.exports = cleanUrlsMiddleware;
