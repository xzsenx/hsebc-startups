import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";

import { useAuth } from "./lib/auth";
import CabinetPage from "./pages/CabinetPage";
import FeedPage from "./pages/FeedPage";
import LoginPage from "./pages/LoginPage";
import NewPostPage from "./pages/NewPostPage";
import PostPage from "./pages/PostPage";
import { Loader } from "./components/ui";

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="header">
      <div className="header__inner">
        <NavLink to="/" className="header__logo">
          Клуб<span>·команда</span>
        </NavLink>
        <nav className="header__nav">
          <NavLink to="/" end className="header__link">
            Лента
          </NavLink>
          {user && (
            <NavLink to="/cabinet" className="header__link">
              Кабинет
            </NavLink>
          )}
        </nav>
        <div className="header__actions">
          {user ? (
            <>
              <button className="btn btn--primary" onClick={() => navigate("/new")}>
                Разместить
              </button>
              <button className="btn btn--ghost" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <button className="btn btn--primary" onClick={() => navigate("/login")}>
              Войти
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/posts/:id" element={<PostPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/new"
            element={
              <Protected>
                <NewPostPage />
              </Protected>
            }
          />
          <Route
            path="/cabinet"
            element={
              <Protected>
                <CabinetPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
