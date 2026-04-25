// Proxies image uploads to Firebase Storage server-side, bypassing browser CORS restrictions.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let meta;
  try {
    meta = JSON.parse(event.headers['x-upload-meta'] || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid x-upload-meta header' }) };
  }

  const { filename, mimeType, token } = meta;
  if (!filename || !mimeType || !token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing filename, mimeType, or token in x-upload-meta' }) };
  }

  const PROJECT_ID = 'newsapplicationtemplate';
  const BUCKETS = [`${PROJECT_ID}.appspot.com`, `${PROJECT_ID}.firebasestorage.app`];
  const encoded = encodeURIComponent(filename);

  // Netlify base64-encodes binary bodies (image/* content types)
  const bodyBuffer = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'binary');

  let lastError = 'Upload failed';
  for (const bucket of BUCKETS) {
    const base = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o`;
    try {
      const res = await fetch(`${base}?uploadType=media&name=${encoded}`, {
        method: 'POST',
        headers: {
          'Content-Type': mimeType,
          Authorization: `Bearer ${token}`,
        },
        body: bodyBuffer,
      });
      const data = await res.json();
      if (res.ok) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: `${base}/${encoded}?alt=media&token=${data.downloadTokens}` }),
        };
      }
      lastError = data?.error?.message ?? 'Upload failed';
      if (res.status !== 404) break;
    } catch (err) {
      lastError = err.message;
      break;
    }
  }

  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: lastError }),
  };
};
