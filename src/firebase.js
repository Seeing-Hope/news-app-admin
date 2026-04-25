// ─── Firebase config ──────────────────────────────────────────────────────────
export const FIREBASE_API_KEY = 'AIzaSyAGZtvfTsZ3NGq9UuHNBLd_wLc4HP3mh8I';
export const FIREBASE_DB_URL  = 'https://newsapplicationtemplate-default-rtdb.firebaseio.com';
const AUTH_BASE = 'https://identitytoolkit.googleapis.com/v1/accounts';
const PROJECT_ID = 'newsapplicationtemplate';
const BUCKETS = [`${PROJECT_ID}.appspot.com`, `${PROJECT_ID}.firebasestorage.app`];

// ─── Core request helper ──────────────────────────────────────────────────────
async function fbReq(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = data?.error;
    const msg = typeof err === 'string' ? err : (err?.message ?? 'Request failed');
    throw new Error(msg);
  }
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function signIn(email, password) {
  const data = await fbReq(`${AUTH_BASE}:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    localId: data.localId,
    email: data.email,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  };
}

export async function refreshIdToken(refreshToken) {
  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'Token refresh failed');
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
}

// ─── Posts ────────────────────────────────────────────────────────────────────
export async function listPosts(idToken) {
  const data = await fbReq(`${FIREBASE_DB_URL}/posts.json?auth=${idToken}`);
  if (!data) return [];
  return Object.entries(data)
    .map(([id, raw]) => {
      const cats = raw.categories ?? (raw.category ? [raw.category] : []);
      const { category: _c, id: _id, ...rest } = raw;
      return { ...rest, categories: cats, id };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getPost(postId, idToken) {
  const raw = await fbReq(`${FIREBASE_DB_URL}/posts/${postId}.json?auth=${idToken}`);
  if (!raw) return null;
  const cats = raw.categories ?? (raw.category ? [raw.category] : []);
  const { category: _c, id: _id, ...rest } = raw;
  return { ...rest, categories: cats, id: postId };
}

export async function createPost(payload, idToken) {
  const post = { ...payload, createdAt: Date.now() };
  return fbReq(`${FIREBASE_DB_URL}/posts.json?auth=${idToken}`, {
    method: 'POST',
    body: JSON.stringify(post),
  });
}

export async function updatePost(postId, patch, idToken) {
  return fbReq(`${FIREBASE_DB_URL}/posts/${postId}.json?auth=${idToken}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deletePost(postId, idToken) {
  return fbReq(`${FIREBASE_DB_URL}/posts/${postId}.json?auth=${idToken}`, {
    method: 'DELETE',
  });
}

// ─── Events ───────────────────────────────────────────────────────────────────
export async function listEvents(idToken) {
  const data = await fbReq(`${FIREBASE_DB_URL}/events.json?auth=${idToken}`);
  if (!data) return [];
  return Object.entries(data)
    .map(([id, ev]) => ({ id, ...ev }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function createEvent(payload, idToken) {
  const ev = { ...payload, createdAt: Date.now() };
  return fbReq(`${FIREBASE_DB_URL}/events.json?auth=${idToken}`, {
    method: 'POST',
    body: JSON.stringify(ev),
  });
}

export async function updateEvent(eventId, patch, idToken) {
  return fbReq(`${FIREBASE_DB_URL}/events/${eventId}.json?auth=${idToken}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteEvent(eventId, idToken) {
  return fbReq(`${FIREBASE_DB_URL}/events/${eventId}.json?auth=${idToken}`, {
    method: 'DELETE',
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function listUsers(idToken) {
  const [rolesMap, emailsMap, profilesMap] = await Promise.all([
    fbReq(`${FIREBASE_DB_URL}/roles.json?auth=${idToken}`),
    fbReq(`${FIREBASE_DB_URL}/userEmails.json?auth=${idToken}`),
    fbReq(`${FIREBASE_DB_URL}/userProfiles.json?auth=${idToken}`),
  ]);
  if (!rolesMap) return [];
  return Object.entries(rolesMap).map(([uid, role]) => ({
    uid,
    email: emailsMap?.[uid]?.email ?? uid,
    role,
    username: profilesMap?.[uid]?.username,
    avatarUrl: profilesMap?.[uid]?.avatarUrl,
  }));
}

export async function updateUserRole(uid, newRole, idToken) {
  return fbReq(`${FIREBASE_DB_URL}/roles/${uid}.json?auth=${idToken}`, {
    method: 'PUT',
    body: JSON.stringify(newRole),
  });
}

// ─── Image upload ─────────────────────────────────────────────────────────────
// ─── Image helpers ───────────────────────────────────────────────────────────
// Compress any image to JPEG ≤ 1600px wide/tall at 82% quality via Canvas.
// Keeps the base64 payload well under Netlify's 6 MB function body limit.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      const MAX = 1600;
      if (width > MAX || height > MAX) {
        const r = Math.min(MAX / width, MAX / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Image compression failed')),
        'image/jpeg', 0.82,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
    img.src = objectUrl;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function uploadImage(file, idToken, folder = 'posts') {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeMap = { png: 'image/png', gif: 'image/gif', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  const mime = mimeMap[ext] ?? 'image/jpeg';
  const filename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const encoded = encodeURIComponent(filename);

  // On Netlify (production), compress the image first then proxy through a serverless
  // function to avoid CORS restrictions. Compression keeps payload under Netlify's 6 MB limit.
  if (!import.meta.env.DEV) {
    const compressed = await compressImage(file);
    const base64 = await blobToBase64(compressed);
    // Always use .jpg filename since we compress to JPEG
    const jpgFilename = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const res = await fetch('/.netlify/functions/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, mimeType: 'image/jpeg', filename: jpgFilename, token: idToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Upload failed');
    return data.url;
  }

  // Local dev: upload directly
  let lastError = 'Image upload failed.';
  for (const bucket of BUCKETS) {
    const base = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o`;
    const res = await fetch(`${base}?uploadType=media&name=${encoded}`, {
      method: 'POST',
      headers: { 'Content-Type': mime, Authorization: `Bearer ${idToken}` },
      body: file,
    });
    const data = await res.json();
    if (res.ok) {
      return `${base}/${encoded}?alt=media&token=${data.downloadTokens}`;
    }
    lastError = data?.error?.message ?? 'Image upload failed.';
    if (res.status !== 404) break;
  }
  throw new Error(lastError);
}
