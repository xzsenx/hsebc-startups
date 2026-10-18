import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { Field, PasswordField, useErrorFocus } from "../components/Field";
import { Alert, Avatar, Spinner } from "../components/ui";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePage } from "../lib/hooks";
import { haptic } from "../lib/telegram";
import { rules, safeNext, validate } from "../lib/validation";

const DEMO = [
  { email: "anna@hsebc-demo.ru", name: "Анна Ковалёва", role: "Автор публикаций, есть входящий отклик" },
  { email: "maks@hsebc-demo.ru", name: "Максим Орлов", role: "Откликался, один отклик уже принят" },
];
const DEMO_PASSWORD = "demo1234";

type Mode = "login" | "register";
const EMPTY = { email: "", password: "", name: "", headline: "", telegram: "" };

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>("login");
  const heading = usePage(mode === "login" ? "Вход" : "Регистрация");
  const formRef = useRef<HTMLFormElement>(null);
  const focusErrors = useErrorFocus(formRef);

  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTouched({});
    setServerErrors({});
    setFormError("");
  }, [mode]);

  if (user) return <Navigate to={next} replace />;

  const schema =
    mode === "login"
      ? { email: [rules.required("Введите почту"), rules.email()], password: [rules.required("Введите пароль")] }
      : {
          name: [rules.required("Как к вам обращаться?"), rules.minLength(2), rules.maxLength(120)],
          email: [rules.required("Введите почту"), rules.email()],
          password: [rules.required("Придумайте пароль"), rules.minLength(8), rules.passwordBytes()],
          headline: [rules.maxLength(160)],
          telegram: [rules.telegram()],
        };
  const clientErrors = validate(values, schema) as Record<string, string | undefined>;
  const errorFor = (field: string) => serverErrors[field] ?? (touched[field] ? clientErrors[field] : undefined);

  const bind = (field: keyof typeof EMPTY) => ({
    name: field,
    value: values[field],
    error: errorFor(field),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
      setServerErrors((s) => ({ ...s, [field]: "" }));
      setFormError("");
    },
    onBlur: () => setTouched((t) => ({ ...t, [field]: true })),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(Object.fromEntries(Object.keys(schema).map((k) => [k, true])));
    if (Object.values(clientErrors).some(Boolean)) {
      focusErrors();
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      if (mode === "login") await login(values.email.trim(), values.password);
      else
        await register({
          email: values.email.trim(),
          password: values.password,
          name: values.name.trim(),
          headline: values.headline.trim(),
          telegram: values.telegram.trim(),
        });
      haptic.success();
      navigate(next, { replace: true });
    } catch (err) {
      haptic.error();
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setServerErrors(err.fields);
        focusErrors();
      } else {
        setFormError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function demoLogin(email: string) {
    setBusy(true);
    setFormError("");
    try {
      await login(email, DEMO_PASSWORD);
      navigate(next, { replace: true });
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="main">
      <div className="auth">
        <div className="page-head">
          <div>
            <h1 className="page-head__title" ref={heading} tabIndex={-1} data-route-focus>
              {mode === "login" ? "Вход" : "Регистрация"}
            </h1>
            <p className="page-head__lead">
              {mode === "login"
                ? "Чтобы размещать публикации и откликаться."
                : "Профиль увидят авторы публикаций, на которые вы откликнетесь."}
            </p>
          </div>
        </div>

        <form ref={formRef} className="form" onSubmit={submit} noValidate>
          {mode === "register" && (
            <Field label="Имя и фамилия" required autoComplete="name" maxLength={120} {...bind("name")} />
          )}
          <Field
            label="Почта"
            required
            type="email"
            inputMode="email"
            autoComplete={mode === "login" ? "username" : "email"}
            autoCapitalize="none"
            spellCheck={false}
            {...bind("email")}
          />
          <PasswordField
            label="Пароль"
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            hint={mode === "register" ? "От 8 символов" : undefined}
            {...bind("password")}
          />
          {mode === "register" && (
            <>
              <Field
                label="Чем занимаетесь"
                placeholder="Например: бэкенд-разработчик, 2 курс ПИ"
                autoComplete="organization-title"
                maxLength={160}
                {...bind("headline")}
              />
              <Field
                label="Ник в Telegram"
                placeholder="@username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                hint="Покажем только тем, чей отклик вы примете или кто примет ваш"
                {...bind("telegram")}
              />
            </>
          )}

          {formError && <Alert tone="error">{formError}</Alert>}

          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy} aria-busy={busy}>
            {busy && <Spinner />}
            {busy ? "Подождите…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        <p className="auth__switch">
          {mode === "login" ? "Нет аккаунта? " : "Уже есть аккаунт? "}
          <button type="button" className="link-btn" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Зарегистрироваться" : "Войти"}
          </button>
        </p>

        {mode === "login" && (
          <section className="demo" aria-labelledby="demo-title">
            <h2 id="demo-title" className="demo__title">
              Демо-аккаунты для проверки
            </h2>
            <p className="subtle">Вход в один клик. Пароль у всех — {DEMO_PASSWORD}.</p>
            {DEMO.map((d) => (
              <button key={d.email} type="button" className="demo__item" onClick={() => demoLogin(d.email)} disabled={busy}>
                <Avatar name={d.name} />
                <span>
                  <span className="person__name">{d.name}</span>
                  <span className="person__headline" style={{ display: "block" }}>
                    {d.role}
                  </span>
                </span>
                <ChevronRight size={18} aria-hidden />
              </button>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
