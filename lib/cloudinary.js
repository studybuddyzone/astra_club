// lib/cloudinary.js
// Minimal Cloudinary helper — no SDK dependency, just crypto (built into
// Node) + fetch. Needs three env vars, all from Cloudinary Dashboard ->
// Settings -> API Keys:
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY       (public — safe in client code, but we keep it
//                              server-side anyway since it's convenient here)
//   CLOUDINARY_API_SECRET    (SECRET — must never reach the browser)

const crypto = require('crypto');

function isConfigured() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

// Cloudinary's signing rule: take every param EXCEPT file/api_key/resource_type,
// sort keys alphabetically, join as "key=value&key2=value2...", append the
// api_secret directly (no separator), then SHA-1 hex the whole string.
function signParams(params) {
  const sorted = Object.keys(params)
    .filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(sorted + process.env.CLOUDINARY_API_SECRET).digest('hex');
}

// Lists images via the Admin API (Search endpoint), scoped to a folder/tag
// so the club's uploads stay separate from anything else in the account.
async function listImages({ folder = 'astra-gallery', maxResults = 60 } = {}) {
  const auth = Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString('base64');
  const resp = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
    body: JSON.stringify({
      expression: `folder:${folder}`,
      sort_by: [{ created_at: 'desc' }],
      max_results: maxResults,
      // The Search API omits context/tags unless explicitly asked for —
      // without this, name/caption/post text silently comes back empty.
      with_field: ['context', 'tags']
    })
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(errBody?.error?.message || `Cloudinary list failed (${resp.status})`);
  }
  const data = await resp.json();
  return (data.resources || []).map(r => ({
    publicId: r.public_id,
    url: r.secure_url,
    width: r.width,
    height: r.height,
    createdAt: r.created_at,
    tags: r.tags || [],
    context: (r.context && (r.context.custom || r.context)) || {}
  }));
}

module.exports = { isConfigured, signParams, listImages };
