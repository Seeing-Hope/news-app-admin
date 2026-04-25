// Proxies image uploads to Firebase Storage server-side, bypassing browser CORS.
// The browser sends { base64, mimeType, filename, token } as JSON.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { base64, mimeType, filename, token } = body;
  if (!base64 || !mimeType || !filename || !token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: base64, mimeType, filename, token' }),
    };
  }

  const PROJECT_ID = 'newsapplicationtemplate';
  const BUCKETS = [`${PROJECT_ID}.appspot.com`, `${PROJECT_ID}.firebasestorage.app`];
  const encoded = encodeURIComponent(filename);
  const fileBuffer = Buffer.from(base64, 'base64');

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
        body: fileBuffer,
      });
      const data = await res.json();
      if (res.ok) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: `${base}/${encoded}?alt=media&token=${data.downloadTokens}` }),
        };
      }
      lastError = data?.error?.message ?? `HTTP ${res.status}`;
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

