// api/cloudinary-sign.js  ->  POST /api/cloudinary-sign
// Used by the Photography workspace's upload panel. The browser never sees
// CLOUDINARY_API_SECRET — it only receives a one-time signature + timestamp
// that Cloudinary itself will check when the upload arrives.

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

  const caller = verifyToken(getToken(req));
  if (!caller || !(hasPermission(caller.role, 'media.manage') || hasPermission(caller.role, '*'))) {
    res.status(403).json({ error: 'You are not authorized to upload to the gallery.' });
    return;
  }

  const { tags, caption, event } = req.body || {};
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder: 'astra-gallery',
    tags: tags || 'gallery',
    context: `caption=${caption || ''}|event=${event || ''}|uploadedBy=${caller.name}`
  };

  const signature = cloudinary.signParams(paramsToSign);

  res.status(200).json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder: paramsToSign.folder,
    tags: paramsToSign.tags,
    context: paramsToSign.context
  });
};
