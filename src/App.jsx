import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/Login';
import PostsPage from './pages/Posts';
import PostEditorPage from './pages/PostEditor';
import QueuePage from './pages/Queue';
import EventsPage from './pages/Events';
import EventEditorPage from './pages/EventEditor';
import UsersPage from './pages/Users';

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="app-loading">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function AuthRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="app-loading">Loading…</div>;
  if (session) return <Navigate to="/posts" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/posts" replace />} />
            <Route path="/posts"          element={<PostsPage />} />
            <Route path="/posts/new"      element={<PostEditorPage />} />
            <Route path="/posts/:id/edit" element={<PostEditorPage />} />
            <Route path="/queue"          element={<QueuePage />} />
            <Route path="/events"         element={<EventsPage />} />
            <Route path="/events/new"     element={<EventEditorPage />} />
            <Route path="/events/:id/edit" element={<EventEditorPage />} />
            <Route path="/users"          element={<UsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/posts" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
