// api/posts.js  ->  GET /api/posts
// Public — the homepage leadership carousel needs to read these without a
// login, same reasoning as api/gallery.js. Adding is what's restricted
// (see api/cloudinary-sign.js, purpose: 'post'), not viewing.

const cloudinary = require('../lib/cloudinary');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!cloudinary.isConfigured()) {
    res.status(200).json({ configured: false, posts: [] });
    return;
  }
  try {
    const images = await cloudinary.listImages({ folder: 'astra-leadership', maxResults: 100 });
    const posts = images.map(img => ({
      url: img.url,
      name: img.context.name || '',
      post: img.context.post || '',
      createdAt: img.createdAt
    }));
    res.status(200).json({ configured: true, posts });
  } catch (err) {
    console.error('Posts list error:', err);
    res.status(500).json({ error: 'Could not load posts right now.' });
  }
};
