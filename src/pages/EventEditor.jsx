import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listEvents, createEvent, updateEvent, uploadImage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import styles from './EventEditor.module.css';

// Trimmed list of the most common countries from the app
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahrain','Bangladesh','Belarus','Belgium','Bolivia','Brazil','Bulgaria','Canada','Chile',
  'China','Colombia','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Ecuador','Egypt',
  'Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Guatemala','Hungary',
  'India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kazakhstan',
  'Kenya','Kuwait','Lebanon','Libya','Malaysia','Mexico','Morocco','Netherlands','New Zealand',
  'Nigeria','Norway','Oman','Pakistan','Palestine','Peru','Philippines','Poland','Portugal',
  'Qatar','Romania','Russia','Saudi Arabia','Senegal','Serbia','Singapore','South Africa',
  'South Korea','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria','Taiwan','Tanzania',
  'Thailand','Tunisia','Turkey','Uganda','Ukraine','United Arab Emirates','United Kingdom',
  'United States','Uzbekistan','Venezuela','Vietnam','Yemen','Zimbabwe',
];

export default function EventEditorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { session } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    eventType: 'in-person',
    country: '',
    city: '',
    videoUrl: '',
    date: '',
    time: '',
    creatorName: '',
    imageUrl: '',
  });
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(isEdit);
  const fileRef = useRef();

  useEffect(() => {
    if (!isEdit) return;
    listEvents(session.idToken)
      .then(all => {
        const ev = all.find(e => e.id === id);
        if (!ev) { navigate('/events'); return; }
        setForm({
          title:       ev.title ?? '',
          description: ev.description ?? '',
          eventType:   ev.eventType ?? 'in-person',
          country:     ev.country ?? '',
          city:        ev.city ?? '',
          videoUrl:    ev.videoUrl ?? '',
          date:        ev.date ?? '',
          time:        ev.time ?? '',
          creatorName: ev.creatorName ?? '',
          imageUrl:    ev.imageUrl ?? '',
        });
        if (ev.imageUrl && !ev.imageUrl.startsWith('data:')) {
          setImagePreview(ev.imageUrl);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isEdit, session.idToken, navigate]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.description.trim()) { setError('Description is required.'); return; }
    if (!form.date) { setError('Date is required.'); return; }
    if (!form.time) { setError('Time is required.'); return; }
    if (!form.creatorName.trim()) { setError('Creator name is required.'); return; }
    if (form.eventType === 'online' && form.videoUrl && !form.videoUrl.startsWith('https://')) {
      setError('Video URL must start with https://'); return;
    }
    setError('');
    setSaving(true);

    try {
      let imageUrl = form.imageUrl;
      if (imageFile) {
        setUploading(true);
        imageUrl = await uploadImage(imageFile, session.idToken, 'events');
        setUploading(false);
      }

      const payload = { ...form, imageUrl };
      if (form.eventType === 'online') { delete payload.country; delete payload.city; }
      else { delete payload.videoUrl; }

      if (isEdit) {
        await updateEvent(id, payload, session.idToken);
      } else {
        await createEvent(payload, session.localId, session.idToken);
      }
      navigate('/events');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading event…</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{isEdit ? 'Edit Event' : 'New Event'}</h1>
          <p className={styles.subtitle}>{isEdit ? form.title || '…' : 'Create a new event'}</p>
        </div>
        <button className={styles.backBtn} onClick={() => navigate('/events')}>← Back</button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.card}>
            <label className={styles.label}>Title <span className={styles.req}>*</span></label>
            <input className={styles.input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Event title" />

            <label className={styles.label}>Description <span className={styles.req}>*</span></label>
            <textarea className={styles.textarea} rows={5} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the event" />
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Event Type</h3>
            <div className={styles.toggleRow}>
              <button
                className={`${styles.toggleBtn} ${form.eventType === 'in-person' ? styles.toggleActive : ''}`}
                onClick={() => set('eventType', 'in-person')}
                type="button"
              >
                📍 In-Person
              </button>
              <button
                className={`${styles.toggleBtn} ${form.eventType === 'online' ? styles.toggleActive : ''}`}
                onClick={() => set('eventType', 'online')}
                type="button"
              >
                🌐 Online
              </button>
            </div>

            {form.eventType === 'in-person' ? (
              <div className={styles.row2}>
                <div className={styles.field}>
                  <label className={styles.label}>Country</label>
                  <select className={styles.select} value={form.country} onChange={e => set('country', e.target.value)}>
                    <option value="">Select country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>City</label>
                  <input className={styles.input} value={form.city} onChange={e => set('city', e.target.value)} placeholder="City name" />
                </div>
              </div>
            ) : (
              <div className={styles.field}>
                <label className={styles.label}>Video URL (optional)</label>
                <input className={styles.input} value={form.videoUrl} onChange={e => set('videoUrl', e.target.value)} placeholder="https://youtube.com/…" />
              </div>
            )}
          </div>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Schedule</h3>
            <div className={styles.field}>
              <label className={styles.label}>Date <span className={styles.req}>*</span></label>
              <input className={styles.input} type="date" value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Time <span className={styles.req}>*</span></label>
              <input className={styles.input} type="time" value={form.time} onChange={e => set('time', e.target.value)} />
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Creator</h3>
            <input className={styles.input} value={form.creatorName} onChange={e => set('creatorName', e.target.value)} placeholder="Organizer name" />
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Cover Image</h3>
            {imagePreview && (
              <img src={imagePreview} className={styles.preview} alt="preview" />
            )}
            <button className={styles.uploadBtn} onClick={() => fileRef.current.click()} type="button">
              {imagePreview ? 'Change Image' : 'Upload Image'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
            <div className={styles.divider}>or paste URL</div>
            <input
              className={styles.input}
              value={imagePreview && imageFile ? '' : form.imageUrl}
              onChange={e => { set('imageUrl', e.target.value); setImagePreview(e.target.value); setImageFile(null); }}
              placeholder="https://…"
            />
          </div>

          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {uploading ? 'Uploading image…' : saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
