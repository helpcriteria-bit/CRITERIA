const crypto = require('node:crypto');
const admin = require('firebase-admin');
const { defineSecret } = require('firebase-functions/params');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');

admin.initializeApp();

const CLOUDINARY_CLOUD_NAME = 'du2knnrre';
const CLOUDINARY_API_KEY = defineSecret('CLOUDINARY_API_KEY');
const CLOUDINARY_API_SECRET = defineSecret('CLOUDINARY_API_SECRET');
const GOOGLE_OAUTH_CLIENT_ID = '427729441325-blo2p97pr37cdv94pps3eo0orfti77kc.apps.googleusercontent.com';
const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');

function trustedRequestOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    const productionOrigin = parsed.origin === 'https://criteriaa.web.app';
    const localOrigin = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
    return productionOrigin || localOrigin ? parsed.origin : null;
  } catch (error) {
    return null;
  }
}

function setOAuthStateCookie(res, value, origin, maxAge) {
  const secure = origin.startsWith('https://') ? '; Secure' : '';
  res.set('Set-Cookie', `criteria_oauth_state=${value}; Path=/api/google-oauth; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`);
}

function getRequestCookie(req, name) {
  const prefix = `${name}=`;
  const item = (req.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(prefix));
  return item ? item.slice(prefix.length) : '';
}

function configureOAuthResponse(res) {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('X-Content-Type-Options', 'nosniff');
}

function cloudinaryDetails(file) {
  let publicId = file.public_id || file.publicId || file.cloudinaryId || '';
  let resourceType = file.resource_type || file.resourceType || '';
  const url = file.url || '';

  if ((!publicId || !resourceType) && url.includes('res.cloudinary.com')) {
    try {
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      const uploadIndex = parts.indexOf('upload');
      if (uploadIndex > 0) {
        resourceType = resourceType || parts[uploadIndex - 1];
        const versionIndex = parts.findIndex((part, index) => index > uploadIndex && /^v\d+$/.test(part));
        if (!publicId && versionIndex >= 0) {
          const publicPath = parts.slice(versionIndex + 1).join('/');
          const lastDot = publicPath.lastIndexOf('.');
          publicId = lastDot > publicPath.lastIndexOf('/') ? publicPath.slice(0, lastDot) : publicPath;
          publicId = decodeURIComponent(publicId);
        }
      }
    } catch (error) {
      logger.warn('Could not parse Cloudinary URL for cleanup.', { url, error: error.message });
    }
  }

  if (resourceType === 'auto') resourceType = '';
  return { publicId, resourceType, isCloudinary: Boolean(file.isCloudinary || file.url?.includes('res.cloudinary.com') || publicId) };
}

function signCloudinaryParams(params, apiSecret) {
  const signed = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(`${signed}${apiSecret}`).digest('hex');
}

async function deleteCloudinaryAsset(file, apiKey, apiSecret) {
  const { publicId, resourceType, isCloudinary } = cloudinaryDetails(file);
  if (!isCloudinary) return { deleted: false, cloudinary: false };
  if (!publicId || !['image', 'video', 'raw'].includes(resourceType)) {
    throw new Error(`Missing Cloudinary public ID or resource type for ${file.name || file.url || 'deliverable'}`);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { invalidate: true, public_id: publicId, timestamp, type: 'upload' };
  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(paramsToSign).map(([key, value]) => [key, String(value)])),
    api_key: apiKey,
    signature: signCloudinaryParams(paramsToSign, apiSecret)
  });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const result = await response.json();
  if (!response.ok || !['ok', 'not found'].includes(result.result)) {
    throw new Error(result.error?.message || `Cloudinary delete failed (${response.status})`);
  }
  return { deleted: true, cloudinary: true, publicId };
}

exports.deleteExpiredClientDeliverables = onSchedule({
  schedule: 'every 15 minutes',
  timeZone: 'UTC',
  region: 'us-central1',
  secrets: [CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]
}, async () => {
  const now = Date.now();
  const db = admin.firestore();
  const snapshot = await db.collection('requests')
    .where('deliverablesExpireAt', '<=', now)
    .limit(100)
    .get();
  const apiKey = CLOUDINARY_API_KEY.value();
  const apiSecret = CLOUDINARY_API_SECRET.value();

  for (const requestDoc of snapshot.docs) {
    const request = requestDoc.data();
    if (!request.workHandedOver || request.deliverablesCleanupCompletedAt) continue;

    const files = request.unlockedDeliverables || [];
    const remainingFiles = [];
    const failures = [];
    let deletedCount = 0;

    for (const file of files) {
      try {
        const result = await deleteCloudinaryAsset(file, apiKey, apiSecret);
        if (result.deleted) deletedCount++;
        else remainingFiles.push(file);
      } catch (error) {
        remainingFiles.push(file);
        failures.push(error.message);
      }
    }

    const cleanupComplete = failures.length === 0;
    const update = {
      unlockedDeliverables: remainingFiles,
      deliverablesCleanupLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      deliverablesCleanupDeletedCount: (request.deliverablesCleanupDeletedCount || 0) + deletedCount,
      deliverablesCleanupComplete: cleanupComplete
    };
    if (cleanupComplete) {
      update.deliverablesCleanupCompletedAt = admin.firestore.FieldValue.serverTimestamp();
      update.deliverablesCleanupError = admin.firestore.FieldValue.delete();
    } else {
      update.deliverablesCleanupError = failures.join('; ').slice(0, 1500);
    }

    await requestDoc.ref.update(update);
    logger.info('Expired deliverables cleanup processed.', {
      requestId: requestDoc.id,
      deletedCount,
      failures: failures.length
    });
  }
});

exports.beginGoogleOAuth = onRequest({ region: 'us-central1' }, (req, res) => {
  configureOAuthResponse(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const origin = trustedRequestOrigin(req);
  if (!origin) return res.status(403).json({ error: 'origin_not_allowed' });

  const state = crypto.randomBytes(32).toString('base64url');
  setOAuthStateCookie(res, state, origin, 600);
  return res.status(200).json({ state });
});

exports.exchangeGoogleOAuthCode = onRequest({
  region: 'us-central1',
  secrets: [GOOGLE_OAUTH_CLIENT_SECRET]
}, async (req, res) => {
  configureOAuthResponse(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const origin = trustedRequestOrigin(req);
  if (!origin) return res.status(403).json({ error: 'origin_not_allowed' });

  const { code, codeVerifier, redirectUri, state } = req.body || {};
  const stateCookie = getRequestCookie(req, 'criteria_oauth_state');
  const validState = typeof state === 'string' && /^[A-Za-z0-9_-]{43}$/.test(state);
  const validStateCookie = /^[A-Za-z0-9_-]{43}$/.test(stateCookie);
  const stateMatches = validState && validStateCookie && stateCookie.length === state.length &&
    crypto.timingSafeEqual(Buffer.from(stateCookie), Buffer.from(state));
  if (!stateMatches || typeof code !== 'string' || code.length > 4096 ||
      typeof codeVerifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) {
    return res.status(403).json({ error: 'invalid_oauth_request' });
  }

  let callbackUrl;
  try {
    callbackUrl = new URL(redirectUri);
  } catch (error) {
    return res.status(400).json({ error: 'invalid_redirect_uri' });
  }
  if (callbackUrl.origin !== origin || callbackUrl.pathname !== '/callback.html' || callbackUrl.search || callbackUrl.hash) {
    return res.status(400).json({ error: 'invalid_redirect_uri' });
  }

  setOAuthStateCookie(res, '', origin, 0);
  try {
    const googleResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        client_secret: GOOGLE_OAUTH_CLIENT_SECRET.value(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      })
    });
    const tokens = await googleResponse.json();
    if (!googleResponse.ok || !tokens.id_token || !tokens.access_token) {
      return res.status(401).json({ error: 'google_token_exchange_failed' });
    }

    return res.status(200).json({
      id_token: tokens.id_token,
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type
    });
  } catch (error) {
    logger.warn('Google OAuth token exchange failed.', { error: error.message });
    return res.status(502).json({ error: 'google_token_exchange_unavailable' });
  }
});
