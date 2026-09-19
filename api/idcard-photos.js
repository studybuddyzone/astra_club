// api/idcard-photos.js
// GET    -> PUBLIC, no login needed. Returns { [slug]: { url, publicId,
//           uploadedBy, uploadedAt } } for every ID card that has a custom
//           photo on file. Used by: every individual id-cards/member-XX-*.html
//           card (to load its own photo), the public idcards.html gallery
//           (thumbnails), and the Joint Secretary's "ID Cards" manager tab
//           (to show current photos + let it decide which cards still need
//           one).
// POST   -> requires members.create (Joint Secretary/Secretary/President/VP,
//           same permission that already gates "Create ID"). Body:
//           { slug, url, publicId }. Called right after a successful signed
//           Cloudinary upload from the manager tab — this just records the
//           resulting URL against that member's card.
// DELETE -> requires members.create. Body: { slug }. Deletes the Cloudinary
//           asset (best-effort, if we still have its publicId on file) AND
//           removes the Realtime Database record, so the card falls back to
//           its original placeholder photo.

const { rtdb } = require('../lib/firebaseAdmin');
const { verifyToken } = require('../lib/authToken');
const { hasPermission } = require('../lib/permissions');
const cloudinary = require('../lib/cloudinary');

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return (req.body && req.body.token) || null;
}

module.exports = async (req, res) => {
  if (!rtdb) {
    res.status(500).json({ error: 'Realtime Database is not configured (missing FIREBASE_DATABASE_URL).' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const snap = await rtdb.ref('idCardPhotos').once('value');
      res.status(200).json(snap.val() || {});
    } catch (err) {
      console.error('idcard-photos GET error:', err);
      res.status(500).json({ error: 'Could not load ID card photos.' });
    }
    return;
  }

  // Everything past this point (adding/removing a photo) is Joint Secretary
  // territory — same permission as creating IDs in the first place.
  const caller = verifyToken(getToken(req));
  if (!caller || !hasPermission(caller.role, 'members.create')) {
    res.status(403).json({ error: 'You are not authorized to manage ID card photos.' });
    return;
  }

  if (req.method === 'POST') {
    const { slug, url, publicId } = req.body || {};
    if (!slug || !url) { res.status(400).json({ error: 'slug and url are required.' }); return; }
    try {
      await rtdb.ref(`idCardPhotos/${slug}`).set({
        url, publicId: publicId || null, uploadedBy: caller.name, uploadedAt: Date.now()
      });
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('idcard-photos POST error:', err);
      res.status(500).json({ error: 'Could not save this photo.' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    const { slug } = req.body || {};
    if (!slug) { res.status(400).json({ error: 'slug is required.' }); return; }
    try {
      const snap = await rtdb.ref(`idCardPhotos/${slug}`).once('value');
      const existing = snap.val();
      if (existing && existing.publicId && cloudinary.isConfigured()) {
        await cloudinary.deleteImage(existing.publicId).catch(() => {}); // best-effort — don't block on Cloudinary hiccups
      }
      await rtdb.ref(`idCardPhotos/${slug}`).remove();
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('idcard-photos DELETE error:', err);
      res.status(500).json({ error: 'Could not remove this photo.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
