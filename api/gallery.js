// api/gallery.js  ->  GET /api/gallery
// Public — the club's photo gallery is meant to be seen by everyone on the
// main website, not just logged-in staff. Uploading is what's restricted
// (see api/cloudinary-sign.js), not viewing.

const cloudinary = require('../lib/cloudinary');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!cloudinary.isConfigured()) {
    // Not an error the visitor needs to see as a red toast — just means no
    // photos yet configured. Return an empty gallery instead of a 500.
    res.status(200).json({ configured: false, images: [] });
    return;
  }
  try {
    const images = await cloudinary.listImages({});
    res.status(200).json({ configured: true, images });
  } catch (err) {
    console.error('Gallery list error:', err);
    res.status(500).json({ error: 'Could not load the gallery right now.' });
  }
};
