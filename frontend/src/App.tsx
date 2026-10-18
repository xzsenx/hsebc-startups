import { lazy, Suspense, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Shell } from "./components/Shell";
import { Spinner } from "./components/ui";
import { useAuth } from "./lib/auth";
import FeedPage from "./pages/FeedPage";

// Лента — первый экран, она в основном бандле. Остальное грузится по требованию.
const PostPage = lazy(() => import("./pages/PostPage"));
const PostFormPage = lazy(() => import("./pages/PostFormPage"));
const CabinetPage = lazy(() => import("./pages/CabinetPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function PageFallback() {
  return (
    <main id="main" className="main" style={{ display: "grid", placeItems: "center", minHeight: "40vh" }}>
      <Spinner label="Загружаем страницу" />
    </main>
  );
}

function Protected({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageFallback />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

export default function App() {
  return (
    <Shell>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/posts/:id" element={<PostPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/new" element={<Protected><PostFormPage /></Protected>} />
          <Route path="/posts/:id/edit" element={<Protected><PostFormPage /></Protected>} />
          <Route path="/cabinet" element={<Protected><CabinetPage /></Protected>} />
          <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
