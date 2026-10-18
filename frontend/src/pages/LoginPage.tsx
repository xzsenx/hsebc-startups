import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ErrorBox } from "../components/ui";
import { useAuth } from "../lib/auth";

const DEMO = [
  { email: "anna@hsebc-demo.ru", label: "Анна — автор публикаций" },
  { email: "maks@hsebc-demo.ru", label: "Максим — откликается" },
];

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", name: "", headline: "", telegram: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--narrow">
      <h1 className="page__title">{mode === "login" ? "Вход" : "Регистрация"}</h1>

      <form className="form" onSubmit={submit}>
        {mode === "register" && (
          <>
            <label className="field">
              <span className="field__label">Имя</span>
              <input className="input" required minLength={2} value={form.name} onChange={update("name")} />
            </label>
            <label className="field">
              <span className="field__label">Чем занимаетесь</span>
              <input
                className="input"
                placeholder="Например: бэкенд-разработчик, 2 курс"
                value={form.headline}
                onChange={update("headline")}
              />
            </label>
            <label className="field">
              <span className="field__label">Телеграм</span>
              <input className="input" placeholder="@username" value={form.telegram} onChange={update("telegram")} />
            </label>
          </>
        )}
        <label className="field">
          <span className="field__label">Почта</span>
          <input className="input" type="email" required value={form.email} onChange={update("email")} />
        </label>
        <label className="field">
          <span className="field__label">Пароль</span>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={update("password")}
          />
          {mode === "register" && <span className="field__hint">Минимум 8 символов</span>}
        </label>

        {error && <ErrorBox message={error} />}

        <button className="btn btn--primary btn--wide" disabled={busy}>
          {busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>

      <button
        className="link-button"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
        }}
      >
        {mode === "login" ? "Нет аккаунта — зарегистрироваться" : "Уже есть аккаунт — войти"}
      </button>

      {mode === "login" && (
        <div className="demo">
          <p className="demo__title">Тестовые аккаунты (пароль demo1234)</p>
          {DEMO.map((d) => (
            <button
              key={d.email}
              className="demo__item"
              onClick={() => setForm({ ...form, email: d.email, password: "demo1234" })}
            >
              <strong>{d.email}</strong>
              <span>{d.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
