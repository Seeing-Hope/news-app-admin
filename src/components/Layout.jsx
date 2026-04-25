import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

const NAV = [
  { to: '/posts',  label: 'Posts',  icon: '📰' },
  { to: '/queue',  label: 'Queue',  icon: '🗂️' },
  { to: '/events', label: 'Events', icon: '📅' },
  { to: '/users',  label: 'Users',  icon: '👥' },
];

export default function Layout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>✦</span>
          <span className={styles.brandName}>News Admin</span>
        </div>
        <nav className={styles.nav}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.avatar}>
              {session?.email?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userEmail}>{session?.email}</span>
              <span className={styles.userRole}>Admin</span>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
