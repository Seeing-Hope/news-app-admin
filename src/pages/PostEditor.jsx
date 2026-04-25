import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPost, createPost, updatePost, uploadImage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import styles from './PostEditor.module.css';

const CATEGORIES = ['Campaigns', 'Voices', 'Dialogue', 'Training', 'Actions', 'Partners', 'Featured'];

export default function PostEditorPage() {
  const { id } = useParams();          // undefined = new post
  const isEdit = Boolean(id);
  const { session } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    summary: '',
    content: '',
    categories: [],
    imageUrl: '',
    youtubeUrl: '',
    authorName: '',
    status: 'draft',
  });
  const [imageFile, setImageFile]   = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(isEdit);
  const fileRef = useRef();
  const contentRef = useRef();
  const inlineFileRef = useRef();

  const [showYtInput, setShowYtInput]     = useState(false);
  const [ytUrlValue, setYtUrlValue]       = useState('');
  const [inlineUploading, setInlineUploading] = useState(false);

  const toEmbedUrl = (url) => {
    const trimmed = url.trim();
    // Accept raw <iframe> embed code — extract the src directly
    const iframeSrc = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
    if (iframeSrc) return iframeSrc;
    // Standard watch URL, short URL, shorts URL, or existing embed URL
    const m = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&?/\s]+)/);
    return m?.[1] ? `https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1&playsinline=1` : null;
  };

  const insertAtCursor = (html) => {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const newContent = form.content.slice(0, start) + '\n' + html + '\n' + form.content.slice(end);
    set('content', newContent);
    requestAnimationFrame(() => {
      const pos = start + html.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const handleInlineImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setInlineUploading(true);
    try {
      const url = await uploadImage(file, session.idToken, 'inline');
      insertAtCursor(`<img src="${url}" alt="image">`);
    } catch (err) {
      setError('Image upload failed: ' + err.message);
    } finally {
      setInlineUploading(false);
    }
  };

  const handleInsertYoutube = () => {
    const embedSrc = toEmbedUrl(ytUrlValue.trim());
    if (!embedSrc) { setError('Invalid YouTube URL or embed code.'); return; }
    insertAtCursor(
      `<iframe src="${embedSrc}" height="315" title="YouTube video" frameborder="0" ` +
      `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
    );
    setYtUrlValue('');
    setShowYtInput(false);
  };

  useEffect(() => {
    if (!isEdit) return;
    getPost(id, session.idToken)
      .then(post => {
        if (!post) { navigate('/posts'); return; }
        setForm({
          title:       post.title ?? '',
          summary:     post.summary ?? '',
          content:     post.content ?? '',
          categories:  post.categories ?? [],
          imageUrl:    post.imageUrl ?? '',
          youtubeUrl:  post.youtubeUrl ?? '',
          authorName:  post.authorName ?? '',
          status:      post.status ?? 'draft',
        });
        if (post.imageUrl && !post.imageUrl.startsWith('data:')) {
          setImagePreview(post.imageUrl);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isEdit, session.idToken, navigate]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const toggleCat = (cat) => {
    setForm(f => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter(c => c !== cat)
        : [...f.categories, cat],
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async (publishDirectly = false) => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.summary.trim()) { setError('Summary is required.'); return; }
    if (!form.content.trim()) { setError('Content is required.'); return; }
    if (!form.authorName.trim()) { setError('Author name is required.'); return; }
    setError('');
    setSaving(true);

    try {
      let imageUrl = form.imageUrl;

      // Upload new image if one was selected
      if (imageFile) {
        setUploading(true);
        imageUrl = await uploadImage(imageFile, session.idToken, 'posts');
        setUploading(false);
      }

      const payload = {
        ...form,
        imageUrl,
        status: publishDirectly ? 'published' : form.status,
      };

      if (isEdit) {
        await updatePost(id, payload, session.idToken);
      } else {
        await createPost(payload, session.localId, session.idToken);
      }
      navigate('/posts');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading post…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{isEdit ? 'Edit Post' : 'New Post'}</h1>
          <p className={styles.subtitle}>{isEdit ? `Editing: ${form.title || '…'}` : 'Create a new article'}</p>
        </div>
        <button className={styles.backBtn} onClick={() => navigate('/posts')}>← Back</button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.layout}>
        {/* Main content */}
        <div className={styles.main}>
          <div className={styles.card}>
            <label className={styles.label}>Title <span className={styles.req}>*</span></label>
            <input
              className={styles.input}
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Article headline"
            />

            <label className={styles.label}>Summary <span className={styles.req}>*</span></label>
            <textarea
              className={styles.textarea}
              rows={3}
              value={form.summary}
              onChange={e => set('summary', e.target.value)}
              placeholder="Short summary shown in article cards"
            />

            <label className={styles.label}>Content <span className={styles.req}>*</span>
              <span className={styles.hint}> (HTML supported)</span>
            </label>

            {/* Inline media toolbar */}
            <div className={styles.mediaToolbar}>
              <button
                type="button"
                className={styles.mediaBtn}
                disabled={inlineUploading}
                onClick={() => inlineFileRef.current.click()}
                title="Insert image at cursor position"
              >
                {inlineUploading ? 'Uploading…' : '📷 Insert Image'}
              </button>
              <button
                type="button"
                className={`${styles.mediaBtn} ${showYtInput ? styles.mediaBtnActive : ''}`}
                onClick={() => { setShowYtInput(v => !v); setYtUrlValue(''); setError(''); }}
                title="Insert YouTube video at cursor position"
              >
                ▶ Insert Video
              </button>
              <input
                ref={inlineFileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleInlineImage}
              />
            </div>

            {showYtInput && (
              <div className={styles.ytRow}>
                <input
                  className={styles.input}
                  value={ytUrlValue}
                  onChange={e => setYtUrlValue(e.target.value)}
                  placeholder="Paste YouTube URL or <iframe> embed code"
                  onKeyDown={e => e.key === 'Enter' && handleInsertYoutube()}
                  autoFocus
                />
                <button type="button" className={styles.ytInsertBtn} onClick={handleInsertYoutube}>
                  Insert
                </button>
              </div>
            )}

            <textarea
              ref={contentRef}
              className={`${styles.textarea} ${styles.contentArea}`}
              rows={18}
              value={form.content}
              onChange={e => set('content', e.target.value)}
              placeholder="Full article content. You can use HTML tags like <b>, <p>, <a href='...'>, etc."
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          {/* Status & publish */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Publish</h3>
            <div className={styles.field}>
              <label className={styles.label}>Status</label>
              <select
                className={styles.select}
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className={styles.btnGroup}>
              <button
                className={styles.saveBtn}
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                {saving && !uploading ? 'Saving…' : 'Save'}
              </button>
              <button
                className={styles.publishBtn}
                onClick={() => handleSave(true)}
                disabled={saving}
              >
                {uploading ? 'Uploading image…' : saving ? 'Publishing…' : 'Publish Now'}
              </button>
            </div>
          </div>

          {/* Author */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Author</h3>
            <input
              className={styles.input}
              value={form.authorName}
              onChange={e => set('authorName', e.target.value)}
              placeholder="Author display name"
            />
          </div>

          {/* Categories */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Categories</h3>
            <div className={styles.catGrid}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`${styles.catBtn} ${form.categories.includes(cat) ? styles.catActive : ''}`}
                  onClick={() => toggleCat(cat)}
                  type="button"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Image */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Cover Image</h3>
            {imagePreview && (
              <img src={imagePreview} className={styles.preview} alt="preview" />
            )}
            <button className={styles.uploadBtn} onClick={() => fileRef.current.click()} type="button">
              {imagePreview ? 'Change Image' : 'Upload Image'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />
            <div className={styles.divider}>or paste URL</div>
            <input
              className={styles.input}
              value={imagePreview && imageFile ? '' : form.imageUrl}
              onChange={e => { set('imageUrl', e.target.value); setImagePreview(e.target.value); setImageFile(null); }}
              placeholder="https://…"
            />
          </div>

          {/* YouTube */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>YouTube URL <span className={styles.optional}>(optional)</span></h3>
            <input
              className={styles.input}
              value={form.youtubeUrl}
              onChange={e => set('youtubeUrl', e.target.value)}
              placeholder="https://youtube.com/…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
