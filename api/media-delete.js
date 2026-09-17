// api/media-delete.js  ->  POST /api/media-delete
// Deletes a single Cloudinary image (public_id) — used by the Photography
// workspace (gallery photos) and Joint Secretary's Post panel (leadership
// photos). The API secret used for the delete call never reaches the
// browser (see lib/cloudinary.js).
//
//   Body: { publicId, purpose: 'gallery' | 'post' }

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
    res.status(500).json({ error: 'Cloudinary is not configured.' });
    return;
  }

  const caller = verifyToken(getToken(req));
  if (!caller) { res.status(403).json({ error: 'Please log in.' }); return; }

  const { publicId, purpose } = req.body || {};
  if (!publicId) { res.status(400).json({ error: 'publicId is required.' }); return; }

  const requiredPermission = purpose === 'post' ? 'post.manage' : 'media.manage';
  if (!(hasPermission(caller.role, requiredPermission) || hasPermission(caller.role, '*'))) {
    res.status(403).json({ error: 'You are not authorized to delete this.' });
    return;
  }

  try {
    await cloudinary.deleteImage(publicId);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Media delete error:', err);
    res.status(500).json({ error: err.message || 'Could not delete this photo.' });
  }
};
