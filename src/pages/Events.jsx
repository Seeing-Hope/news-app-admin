import { useEffect, useState } from 'react';
import { listEvents, deleteEvent } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import styles from './Events.module.css';

export default function EventsPage() {
  const { session } = useAuth();
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listEvents(session.idToken);
      setEvents(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (ev) => {
    if (!confirm(`Delete "${ev.title}"?`)) return;
    setDeleting(ev.id);
    try {
      await deleteEvent(ev.id, session.idToken);
      setEvents(e => e.filter(x => x.id !== ev.id));
    } catch (e) {
      alert('Delete failed: ' + e.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Events</h1>
          <p className={styles.subtitle}>{events.length} total events</p>
        </div>
        <Link to="/events/new" className={styles.newBtn}>+ New Event</Link>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.empty}>Loading events…</div>
      ) : events.length === 0 ? (
        <div className={styles.empty}>No events yet. Create one!</div>
      ) : (
        <div className={styles.grid}>
          {events.map(ev => (
            <div key={ev.id} className={styles.card}>
              {ev.imageUrl && !ev.imageUrl.startsWith('data:') ? (
                <img src={ev.imageUrl} className={styles.thumb} alt="" onError={e => e.target.style.display='none'} />
              ) : (
                <div className={styles.thumbPlaceholder}>📅</div>
              )}
              <div className={styles.cardBody}>
                <div className={styles.topRow}>
                  <span className={`${styles.typeBadge} ${ev.eventType === 'online' ? styles.online : styles.inPerson}`}>
                    {ev.eventType === 'online' ? '🌐 Online' : '📍 In-Person'}
                  </span>
                  <span className={styles.date}>{ev.date} {ev.time}</span>
                </div>
                <h3 className={styles.eventTitle}>{ev.title}</h3>
                <p className={styles.desc}>{ev.description}</p>
                {ev.country && (
                  <p className={styles.location}>{ev.city ? `${ev.city}, ` : ''}{ev.country}</p>
                )}
                <div className={styles.meta}>By <strong>{ev.creatorName}</strong></div>
              </div>
              <div className={styles.cardActions}>
                <Link to={`/events/${ev.id}/edit`} className={styles.editBtn}>Edit</Link>
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(ev)}
                  disabled={deleting === ev.id}
                >
                  {deleting === ev.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
