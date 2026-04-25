import { useEffect, useState } from 'react';
import { listPosts, updatePost } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import styles from './Queue.module.css';

export default function QueuePage() {
  const { session } = useAuth();
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [notes, setNotes]       = useState({});  // postId -> review note text
  const [acting, setActing]     = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await listPosts(session.idToken);
      setPosts(all.filter(p => p.status === 'pending_review'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (post) => {
    setActing(post.id);
    try {
      await updatePost(post.id, { status: 'published', reviewNote: '' }, session.idToken);
      setPosts(p => p.filter(x => x.id !== post.id));
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setActing(null);
    }
  };

  const requestChanges = async (post) => {
    const note = notes[post.id]?.trim();
    if (!note) { alert('Please add a review note before requesting changes.'); return; }
    setActing(post.id);
    try {
      await updatePost(post.id, { status: 'draft', reviewNote: note }, session.idToken);
      setPosts(p => p.filter(x => x.id !== post.id));
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Editorial Queue</h1>
          <p className={styles.subtitle}>Posts awaiting review</p>
        </div>
        <span className={styles.countBadge}>{posts.length} pending</span>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.empty}>Loading queue…</div>
      ) : posts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>✓</div>
          <p>Queue is empty — all posts reviewed.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {posts.map(post => (
            <div key={post.id} className={styles.card}>
              <div className={styles.cardTop}>
                {post.imageUrl && !post.imageUrl.startsWith('data:') && (
                  <img src={post.imageUrl} className={styles.thumb} alt="" onError={e => e.target.style.display='none'} />
                )}
                <div className={styles.cardMeta}>
                  <h3 className={styles.postTitle}>{post.title}</h3>
                  <p className={styles.postSummary}>{post.summary}</p>
                  <div className={styles.metaRow}>
                    <span>By <strong>{post.authorName}</strong></span>
                    <span>•</span>
                    <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    {post.categories?.length > 0 && (
                      <>
                        <span>•</span>
                        <span>{post.categories.join(', ')}</span>
                      </>
                    )}
                  </div>
                  {post.reviewNote && (
                    <div className={styles.prevNote}>
                      Previous note: {post.reviewNote}
                    </div>
                  )}
                </div>
                <Link to={`/posts/${post.id}/edit`} className={styles.viewBtn}>Edit</Link>
              </div>

              <div className={styles.reviewRow}>
                <textarea
                  className={styles.noteInput}
                  rows={2}
                  placeholder="Review note (required for requesting changes)"
                  value={notes[post.id] ?? ''}
                  onChange={e => setNotes(n => ({ ...n, [post.id]: e.target.value }))}
                />
                <div className={styles.reviewBtns}>
                  <button
                    className={styles.approveBtn}
                    onClick={() => approve(post)}
                    disabled={acting === post.id}
                  >
                    {acting === post.id ? '…' : '✓ Approve & Publish'}
                  </button>
                  <button
                    className={styles.rejectBtn}
                    onClick={() => requestChanges(post)}
                    disabled={acting === post.id}
                  >
                    Request Changes
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
