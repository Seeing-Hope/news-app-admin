import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPost, createPost, updatePost, uploadImage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import styles from './PostEditor.module.css';

const CATEGORIES = ['Campaigns', 'Voices', 'Dialogue', 'Training', 'Actions', 'Partners', 'Featured'];

export default function PostEditorPage() {
  const { id } = useParams();
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
  const [imageFile, setImageFile]       = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(isEdit);

  const fileRef       = useRef();
  const contentRef    = useRef();
  const inlineFileRef = useRef();
  const contentLoaded = useRef(false);
  const savedRange    = useRef(null);

  const [showYtInput,     setShowYtInput]     = useState(false);
  const [ytUrlValue,      setYtUrlValue]       = useState('');
  const [showImgInput,    setShowImgInput]     = useState(false);
  const [imgUrlValue,     setImgUrlValue]      = useState('');
  const [inlineUploading, setInlineUploading] = useState(false);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const toggleCat = (cat) => setForm(f => ({
    ...f,
    categories: f.categories.includes(cat)
      ? f.categories.filter(c => c !== cat)
      : [...f.categories, cat],
  }));

  const getContent = () => {
    const el = contentRef.current;
    if (!el) return form.content;
    let html = el.innerHTML;
    if (html === '<br>' || html === '') return '';
    // Strip trailing empty block elements that contenteditable inserts
    html = html.replace(/(\s*<(p|div|h[1-6]|blockquote|li)[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/\2>)+\s*$/gi, '').trim();
    return html;
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const insertAtCursor = (html) => {
    const el = contentRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand('insertHTML', false, html);
    savedRange.current = null;
  };

  const execFormat = (command, value = null) => {
    contentRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const toEmbedUrl = (url) => {
    const trimmed = url.trim();
    const iframeSrc = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
    if (iframeSrc) return iframeSrc;
    const m = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([^&?/\s]+)/);
    return m?.[1] ? `https://www.youtube.com/embed/${m[1]}?rel=0&modestbranding=1&playsinline=1` : null;
  };

  const handleInsertImageUrl = () => {
    const url = imgUrlValue.trim();
    if (!url) { setError('Please enter an image URL.'); return; }
    insertAtCursor(`<img src="${url}" alt="image">`);
    setImgUrlValue('');
    setShowImgInput(false);
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

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  useEffect(() => {
    if (!isEdit || loading || !contentRef.current || contentLoaded.current) return;
    contentRef.current.innerHTML = form.content || '';
    contentLoaded.current = true;
  }, [loading, form.content, isEdit]);

  useEffect(() => {
    if (!isEdit) return;
    getPost(id, session.idToken)
      .then(post => {
        if (!post) { navigate('/posts'); return; }
        setForm({
          title:      post.title ?? '',
          summary:    post.summary ?? '',
          content:    post.content ?? '',
          categories: post.categories ?? [],
          imageUrl:   post.imageUrl ?? '',
          youtubeUrl: post.youtubeUrl ?? '',
          authorName: post.authorName ?? '',
          status:     post.status ?? 'draft',
        });
        if (post.imageUrl && !post.imageUrl.startsWith('data:')) {
          setImagePreview(post.imageUrl);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isEdit, session.idToken, navigate]);

  const handleSave = async (publishDirectly = false) => {
    const content = getContent();
    if (!form.title.trim())      { setError('Title is required.');       return; }
    if (!form.summary.trim())    { setError('Summary is required.');     return; }
    if (!content.trim())         { setError('Content is required.');     return; }
    if (!form.authorName.trim()) { setError('Author name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      let imageUrl = form.imageUrl;
      if (imageFile) {
        setUploading(true);
        imageUrl = await uploadImage(imageFile, session.idToken, 'posts');
        setUploading(false);
      }
      const payload = {
        ...form,
        content,
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

  if (loading) return <div className={styles.loading}>Loading post...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{isEdit ? 'Edit Post' : 'New Post'}</h1>
          <p className={styles.subtitle}>{isEdit ? `Editing: ${form.title || '...'}` : 'Create a new article'}</p>
        </div>
        <button className={styles.backBtn} onClick={() => navigate('/posts')}>Back</button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.layout}>
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

            <label className={styles.label}>Content <span className={styles.req}>*</span></label>

            <div className={styles.editorToolbar}>
              <div className={styles.toolbarGroup}>
                <button type="button" className={styles.fmtBtn} title="Bold"
                  onMouseDown={e => { e.preventDefault(); execFormat('bold'); }}><b>B</b></button>
                <button type="button" className={styles.fmtBtn} title="Italic"
                  onMouseDown={e => { e.preventDefault(); execFormat('italic'); }}><i>I</i></button>
                <button type="button" className={styles.fmtBtn} title="Underline"
                  onMouseDown={e => { e.preventDefault(); execFormat('underline'); }}><u>U</u></button>
                <button type="button" className={styles.fmtBtn} title="Strikethrough"
                  onMouseDown={e => { e.preventDefault(); execFormat('strikeThrough'); }}><s>S</s></button>
              </div>
              <div className={styles.toolbarSep} />
              <div className={styles.toolbarGroup}>
                <button type="button" className={styles.fmtBtn} title="Normal paragraph"
                  onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'p'); }}>P</button>
                <button type="button" className={styles.fmtBtn} title="Heading 2"
                  onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'h2'); }}>H2</button>
                <button type="button" className={styles.fmtBtn} title="Heading 3"
                  onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'h3'); }}>H3</button>
                <button type="button" className={styles.fmtBtn} title="Blockquote"
                  onMouseDown={e => { e.preventDefault(); execFormat('formatBlock', 'blockquote'); }}>Q</button>
              </div>
              <div className={styles.toolbarSep} />
              <div className={styles.toolbarGroup}>
                <button type="button" className={styles.fmtBtn} title="Align left"
                  onMouseDown={e => { e.preventDefault(); execFormat('justifyLeft'); }}>Left</button>
                <button type="button" className={styles.fmtBtn} title="Center"
                  onMouseDown={e => { e.preventDefault(); execFormat('justifyCenter'); }}>Center</button>
                <button type="button" className={styles.fmtBtn} title="Align right"
                  onMouseDown={e => { e.preventDefault(); execFormat('justifyRight'); }}>Right</button>
              </div>
              <div className={styles.toolbarSep} />
              <div className={styles.toolbarGroup}>
                <button type="button" className={styles.fmtBtn} title="Bullet list"
                  onMouseDown={e => { e.preventDefault(); execFormat('insertUnorderedList'); }}>List</button>
                <button type="button" className={styles.fmtBtn} title="Numbered list"
                  onMouseDown={e => { e.preventDefault(); execFormat('insertOrderedList'); }}>1. List</button>
              </div>
              <div className={styles.toolbarSep} />
              <div className={styles.toolbarGroup}>
                <button type="button" className={styles.fmtBtn} title="Clear formatting"
                  onMouseDown={e => { e.preventDefault(); execFormat('removeFormat'); }}>Clear</button>
              </div>
            </div>

            <div className={styles.mediaToolbar}>
              <button
                type="button"
                className={`${styles.mediaBtn} ${showImgInput ? styles.mediaBtnActive : ''}`}
                onClick={() => { setShowImgInput(v => !v); setImgUrlValue(''); setShowYtInput(false); setError(''); }}
              >
                Image URL
              </button>
              <button
                type="button"
                className={`${styles.mediaBtn} ${showYtInput ? styles.mediaBtnActive : ''}`}
                onClick={() => { setShowYtInput(v => !v); setYtUrlValue(''); setShowImgInput(false); setError(''); }}
              >
                Insert Video
              </button>
              <input ref={inlineFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleInlineImage} />
            </div>

            {showImgInput && (
              <div className={styles.ytRow}>
                <input
                  className={styles.input}
                  value={imgUrlValue}
                  onChange={e => setImgUrlValue(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  onKeyDown={e => e.key === 'Enter' && handleInsertImageUrl()}
                  autoFocus
                />
                <button type="button" className={styles.ytInsertBtn} onClick={handleInsertImageUrl}>Insert</button>
              </div>
            )}

            {showYtInput && (
              <div className={styles.ytRow}>
                <input
                  className={styles.input}
                  value={ytUrlValue}
                  onChange={e => setYtUrlValue(e.target.value)}
                  placeholder="Paste YouTube URL or iframe embed code"
                  onKeyDown={e => e.key === 'Enter' && handleInsertYoutube()}
                  autoFocus
                />
                <button type="button" className={styles.ytInsertBtn} onClick={handleInsertYoutube}>Insert</button>
              </div>
            )}

            <div
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              className={styles.contentEditable}
              data-placeholder="Write your article here..."
              onBlur={saveSelection}
            />
          </div>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Publish</h3>
            <div className={styles.field}>
              <label className={styles.label}>Status</label>
              <select className={styles.select} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className={styles.btnGroup}>
              <button className={styles.saveBtn} onClick={() => handleSave(false)} disabled={saving}>
                {saving && !uploading ? 'Saving...' : 'Save'}
              </button>
              <button className={styles.publishBtn} onClick={() => handleSave(true)} disabled={saving}>
                {uploading ? 'Uploading image...' : saving ? 'Publishing...' : 'Publish Now'}
              </button>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Author</h3>
            <input
              className={styles.input}
              value={form.authorName}
              onChange={e => set('authorName', e.target.value)}
              placeholder="Author display name"
            />
          </div>

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

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Cover Image</h3>
            {imagePreview && <img src={imagePreview} className={styles.preview} alt="preview" />}
            <button className={styles.uploadBtn} onClick={() => fileRef.current.click()} type="button">
              {imagePreview ? 'Change Image' : 'Upload Image'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
            <div className={styles.divider}>or paste URL</div>
            <input
              className={styles.input}
              value={imagePreview && imageFile ? '' : form.imageUrl}
              onChange={e => { set('imageUrl', e.target.value); setImagePreview(e.target.value); setImageFile(null); }}
              placeholder="https://..."
            />
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>YouTube URL <span className={styles.optional}>(optional)</span></h3>
            <input
              className={styles.input}
              value={form.youtubeUrl}
              onChange={e => set('youtubeUrl', e.target.value)}
              placeholder="https://youtube.com/..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
