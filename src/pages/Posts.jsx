import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPosts, deletePost, updatePost } from '../firebase';
import { useAuth } from '../context/AuthContext';
import styles from './Posts.module.css';

const STATUS_LABEL = { draft: 'Draft', pending_review: 'Pending', published: 'Published' };
const STATUS_CLASS = { draft: 'draft', pending_review: 'pending', published: 'published' };

export default function PostsPage() {
  const { session } = useAuth();
  const [posts, setPosts]       = useState([]);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listPosts(session.idToken);
      setPosts(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (post) => {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeleting(post.id);
    try {
      await deletePost(post.id, session.idToken);
      setPosts(p => p.filter(x => x.id !== post.id));
    } catch (e) {
      alert('Delete failed: ' + e.message);
    } finally {
      setDeleting(null);
    }
  };

  const handlePublish = async (post) => {
    try {
      await updatePost(post.id, { status: 'published' }, session.idToken);
      setPosts(p => p.map(x => x.id === post.id ? { ...x, status: 'published' } : x));
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

  const handleUnpublish = async (post) => {
    try {
      await updatePost(post.id, { status: 'draft' }, session.idToken);
      setPosts(p => p.map(x => x.id === post.id ? { ...x, status: 'draft' } : x));
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  };

  const filtered = posts.filter(p => {
    const matchStatus = filter === 'all' || p.status === filter;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.authorName?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = {
    all: posts.length,
    published: posts.filter(p => p.status === 'published').length,
    pending_review: posts.filter(p => p.status === 'pending_review').length,
    draft: posts.filter(p => p.status === 'draft').length,
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Posts</h1>
          <p className={styles.subtitle}>{posts.length} total articles</p>
        </div>
        <Link to="/posts/new" className={styles.newBtn}>+ New Post</Link>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {[
            ['all', 'All'],
            ['published', 'Published'],
            ['pending_review', 'Pending Review'],
            ['draft', 'Draft'],
          ].map(([val, label]) => (
            <button
              key={val}
              className={`${styles.filterBtn} ${filter === val ? styles.filterActive : ''}`}
              onClick={() => setFilter(val)}
            >
              {label} <span className={styles.filterCount}>{counts[val]}</span>
            </button>
          ))}
        </div>
        <input
          className={styles.search}
          placeholder="Search by title or author…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.loading}>Loading posts…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>No posts found.</div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Title</span>
            <span>Author</span>
            <span>Status</span>
            <span>Date</span>
            <span>Actions</span>
          </div>
          {filtered.map(post => (
            <div key={post.id} className={styles.row}>
              <div className={styles.cellTitle}>
                {post.imageUrl && (
                  <img
                    src={post.imageUrl.startsWith('data:') ? undefined : post.imageUrl}
                    className={styles.thumb}
                    alt=""
                    onError={e => e.target.style.display = 'none'}
                  />
                )}
                <div>
                  <span className={styles.postTitle}>{post.title}</span>
                  {post.categories?.length > 0 && (
                    <div className={styles.cats}>
                      {post.categories.map(c => (
                        <span key={c} className={styles.cat}>{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <span className={styles.cell}>{post.authorName}</span>
              <span className={styles.cell}>
                <span className={`${styles.badge} ${styles[STATUS_CLASS[post.status]]}`}>
                  {STATUS_LABEL[post.status]}
                </span>
              </span>
              <span className={styles.cell}>
                {new Date(post.createdAt).toLocaleDateString()}
              </span>
              <div className={styles.actions}>
                <Link to={`/posts/${post.id}/edit`} className={styles.editBtn}>Edit</Link>
                {post.status !== 'published' && (
                  <button className={styles.publishBtn} onClick={() => handlePublish(post)}>
                    Publish
                  </button>
                )}
                {post.status === 'published' && (
                  <button className={styles.unpublishBtn} onClick={() => handleUnpublish(post)}>
                    Unpublish
                  </button>
                )}
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleDelete(post)}
                  disabled={deleting === post.id}
                >
                  {deleting === post.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
