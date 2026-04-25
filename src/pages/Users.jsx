import { useEffect, useState } from 'react';
import { listUsers, updateUserRole } from '../firebase';
import { useAuth } from '../context/AuthContext';
import styles from './Users.module.css';

const ROLES = ['user', 'writer', 'editor', 'admin'];
const ROLE_COLOR = {
  admin:  { bg: '#3A3A3A', color: '#fff' },
  editor: { bg: '#3F78C5', color: '#fff' },
  writer: { bg: '#3E8B8F', color: '#fff' },
  user:   { bg: '#F4EFEB', color: '#5F6757' },
};

export default function UsersPage() {
  const { session } = useAuth();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [updating, setUpdating] = useState(null);
  const [confirm, setConfirm]   = useState(null);   // { uid, email, newRole }

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listUsers(session.idToken);
      setUsers(data.sort((a, b) => {
        const order = { admin: 0, editor: 1, writer: 2, user: 3 };
        return (order[a.role] ?? 4) - (order[b.role] ?? 4);
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRoleClick = (user, newRole) => {
    if (user.role === newRole) return;
    setConfirm({ uid: user.uid, email: user.email, currentRole: user.role, newRole });
  };

  const confirmChange = async () => {
    const { uid, newRole } = confirm;
    setConfirm(null);
    setUpdating(uid);
    try {
      await updateUserRole(uid, newRole, session.idToken);
      setUsers(u => u.map(x => x.uid === uid ? { ...x, role: newRole } : x));
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setUpdating(null);
    }
  };

  const filtered = users.filter(u =>
    !search ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Users</h1>
          <p className={styles.subtitle}>{users.length} registered accounts</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search by email or username…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.legend}>
          {ROLES.map(r => (
            <span key={r} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: ROLE_COLOR[r].bg }} />
              {r}
            </span>
          ))}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.empty}>Loading users…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>No users found.</div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>User</span>
            <span>Email</span>
            <span>Current Role</span>
            <span>Change Role</span>
          </div>
          {filtered.map(user => (
            <div key={user.uid} className={styles.row}>
              <div className={styles.userCell}>
                <div
                  className={styles.avatar}
                  style={{ background: ROLE_COLOR[user.role]?.bg ?? '#F4EFEB' }}
                >
                  {user.avatarUrl && !user.avatarUrl.startsWith('data:') ? (
                    <img src={user.avatarUrl} alt="" className={styles.avatarImg} onError={e => e.target.style.display='none'} />
                  ) : (
                    <span style={{ color: ROLE_COLOR[user.role]?.color ?? '#5F6757' }}>
                      {(user.username || user.email)[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <span className={styles.username}>{user.username ?? '—'}</span>
                  <span className={styles.uid}>uid: {user.uid.slice(0, 8)}…</span>
                </div>
              </div>
              <span className={styles.cell}>{user.email}</span>
              <span className={styles.cell}>
                <span
                  className={styles.roleBadge}
                  style={{
                    background: ROLE_COLOR[user.role]?.bg,
                    color: ROLE_COLOR[user.role]?.color,
                  }}
                >
                  {user.role}
                </span>
              </span>
              <div className={styles.roleButtons}>
                {ROLES.map(r => (
                  <button
                    key={r}
                    className={`${styles.roleBtn} ${user.role === r ? styles.roleBtnActive : ''}`}
                    onClick={() => handleRoleClick(user, r)}
                    disabled={updating === user.uid || user.role === r}
                    style={user.role === r ? {
                      background: ROLE_COLOR[r].bg,
                      color: ROLE_COLOR[r].color,
                      borderColor: ROLE_COLOR[r].bg,
                    } : {}}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className={styles.overlay} onClick={() => setConfirm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Change Role</h3>
            <p className={styles.modalBody}>
              Change <strong>{confirm.email}</strong> from{' '}
              <strong>{confirm.currentRole}</strong> to{' '}
              <strong>{confirm.newRole}</strong>?
            </p>
            <div className={styles.modalBtns}>
              <button className={styles.cancelBtn} onClick={() => setConfirm(null)}>Cancel</button>
              <button className={styles.confirmBtn} onClick={confirmChange}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
