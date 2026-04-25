// Proxies image uploads to Firebase Storage server-side, bypassing browser CORS.
// Receives { base64, mimeType, filename, token } as JSON.
// Images are pre-compressed client-side to JPEG ≤ 1600px, keeping payloads small.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Netlify Functions hard limit is 6 MB — reject early with a clear message
  if ((event.body || '').length > 5_500_000) {
    return {
      statusCode: 413,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Image too large. Please use an image smaller than 4 MB.' }),
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  const { base64, mimeType, filename, token } = parsed;
  if (!base64 || !mimeType || !filename || !token) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing required fields: base64, mimeType, filename, token' }),
    };
  }

  const PROJECT_ID = 'newsapplicationtemplate';
  const BUCKETS = [`${PROJECT_ID}.appspot.com`, `${PROJECT_ID}.firebasestorage.app`];
  const encodedName = encodeURIComponent(filename);

  // Use Blob — the correct body type for Node 22 native fetch
  const fileBytes = Buffer.from(base64, 'base64');
  const blob = new Blob([fileBytes], { type: mimeType });

  let lastError = 'Upload failed';
  for (const bucket of BUCKETS) {
    const storageBase = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o`;
    const uploadUrl = `${storageBase}?uploadType=media&name=${encodedName}`;
    try {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
          Authorization: `Bearer ${token}`,
        },
        body: blob,
      });

      let data = {};
      try { data = await res.json(); } catch { /* ignore non-JSON responses */ }

      if (res.ok) {
        const dlToken = data.downloadTokens;
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: dlToken
              ? `${storageBase}/${encodedName}?alt=media&token=${dlToken}`
              : `${storageBase}/${encodedName}?alt=media`,
          }),
        };
      }

      lastError = data?.error?.message ?? `Firebase returned HTTP ${res.status}`;
      if (res.status !== 404) break; // Only try next bucket on 404 (bucket not found)
    } catch (err) {
      lastError = `Network error: ${err.message}`;
      break;
    }
  }

  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: lastError }),
  };
};


