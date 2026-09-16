// api/cloudinary-sign.js  ->  POST /api/cloudinary-sign
// Used by the Photography workspace, Joint Secretary's "Post" panel, AND
// the public Assistant Registration form (payment receipt upload). The
// browser never sees CLOUDINARY_API_SECRET — it only receives a one-time
// signature + timestamp that Cloudinary itself will check on upload.
//
//   Body: { purpose: 'gallery' | 'post' | 'receipt', ... }
//
// 'gallery' -> requires media.manage (Photography), uploads to astra-gallery.
// 'post'    -> requires post.manage (Joint Secretary), uploads to
//              astra-leadership, stores name + post/title in context.
// 'receipt' -> PUBLIC, no login required (the registrant has no account
//              yet) — uploads to astra-registration-receipts only. This is
//              deliberately the one purpose that skips the auth check.

const { verifyToken } = require('../lib/authToken');
const { hasPermission } = require('../lib/permissions');
const cloudinary = require('../lib/cloudinary');

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return (req.body && req.body.token) || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!cloudinary.isConfigured()) {
    res.status(500).json({ error: 'Cloudinary is not configured yet (missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET).' });
    return;
  }

  const purpose = ['post', 'receipt'].includes(req.body && req.body.purpose) ? req.body.purpose : 'gallery';

  let caller = null;
  if (purpose !== 'receipt') {
    caller = verifyToken(getToken(req));
    if (!caller) { res.status(403).json({ error: 'Please log in.' }); return; }
    if (purpose === 'post' && !(hasPermission(caller.role, 'post.manage') || hasPermission(caller.role, '*'))) {
      res.status(403).json({ error: 'You are not authorized to add a leadership post.' });
      return;
    }
    if (purpose === 'gallery' && !(hasPermission(caller.role, 'media.manage') || hasPermission(caller.role, '*'))) {
      res.status(403).json({ error: 'You are not authorized to upload to the gallery.' });
      return;
    }
  }

  const { tags, caption, event, name, post } = req.body || {};
  const timestamp = Math.round(Date.now() / 1000);

  let paramsToSign;
  if (purpose === 'post') {
    paramsToSign = { timestamp, folder: 'astra-leadership', tags: 'leadership', context: `name=${name || ''}|post=${post || ''}|addedBy=${caller.name}` };
  } else if (purpose === 'receipt') {
    paramsToSign = { timestamp, folder: 'astra-registration-receipts', tags: 'receipt' };
  } else {
    paramsToSign = { timestamp, folder: 'astra-gallery', tags: tags || 'gallery', context: `caption=${caption || ''}|event=${event || ''}|uploadedBy=${caller.name}` };
  }

  const signature = cloudinary.signParams(paramsToSign);

  res.status(200).json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder: paramsToSign.folder,
    tags: paramsToSign.tags,
    context: paramsToSign.context || null
  });
};
