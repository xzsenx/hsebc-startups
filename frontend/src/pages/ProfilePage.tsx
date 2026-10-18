import { ArrowLeft, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Field, useErrorFocus } from "../components/Field";
import { Alert, Person, Spinner } from "../components/ui";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePage } from "../lib/hooks";
import { haptic } from "../lib/telegram";
import { useToast } from "../lib/toast";
import { rules, validate } from "../lib/validation";

const SCHEMA = {
  name: [rules.required("Имя обязательно"), rules.minLength(2), rules.maxLength(120)],
  headline: [rules.maxLength(160)],
  bio: [rules.maxLength(1000)],
  telegram: [rules.telegram()],
};

export default function ProfilePage() {
  const heading = usePage("Профиль");
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const focusErrors = useErrorFocus(formRef);

  const initial = {
    name: user?.name ?? "",
    headline: user?.headline ?? "",
    bio: user?.bio ?? "",
    telegram: user?.telegram ?? "",
  };
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setValues({ name: user.name, headline: user.headline, bio: user.bio, telegram: user.telegram });
  }, [user]);

  const clientErrors = validate(values, SCHEMA) as Record<string, string | undefined>;
  const errorFor = (field: string) => serverErrors[field] ?? (touched[field] ? clientErrors[field] : undefined);
  const dirty = user ? JSON.stringify(values) !== JSON.stringify({ name: user.name, headline: user.headline, bio: user.bio, telegram: user.telegram }) : false;

  const bind = (field: keyof typeof initial) => ({
    value: values[field],
    error: errorFor(field),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
      setServerErrors((s) => ({ ...s, [field]: "" }));
    },
    onBlur: () => setTouched((t) => ({ ...t, [field]: true })),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, headline: true, bio: true, telegram: true });
    if (Object.values(clientErrors).some(Boolean)) {
      focusErrors();
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await updateProfile({
        name: values.name.trim(),
        headline: values.headline.trim(),
        bio: values.bio.trim(),
        telegram: values.telegram.trim(),
      });
      haptic.success();
      toast("Профиль сохранён");
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

  return (
    <main id="main" className="main main--reading">
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} aria-hidden />
        Назад
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-head__title" ref={heading} tabIndex={-1} data-route-focus>
            Профиль
          </h1>
          <p className="page-head__lead">Это видят авторы публикаций, на которые вы откликаетесь.</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <span className="section-title">Предпросмотр</span>
        <Person name={values.name || "Ваше имя"} headline={values.headline} size="lg" />
        {values.bio && <p className="muted">{values.bio}</p>}
      </div>

      <form ref={formRef} className="form" onSubmit={submit} noValidate>
        <Field label="Имя и фамилия" required autoComplete="name" maxLength={120} {...bind("name")} />
        <Field label="Чем занимаетесь" placeholder="Например: бэкенд-разработчик, 2 курс ПИ" maxLength={160} {...bind("headline")} />
        <Field
          multiline
          rows={4}
          label="О себе"
          placeholder="Опыт, проекты, что ищете в Клубе"
          maxLength={1000}
          {...bind("bio")}
        />
        <Field
          label="Ник в Telegram"
          placeholder="@username"
          autoCapitalize="none"
          spellCheck={false}
          hint="Открывается только после принятия отклика — в ленте его не видно"
          {...bind("telegram")}
        />
        <p className="subtle">Почта для входа: {user?.email}</p>

        {formError && <Alert tone="error">{formError}</Alert>}

        <div className="form-actions">
          <button type="submit" className="btn btn--primary btn--lg" disabled={busy || !dirty} aria-busy={busy}>
            {busy && <Spinner />}
            {busy ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>

      <hr className="divider" style={{ margin: "32px 0 16px" }} />
      <button type="button" className="btn btn--ghost" onClick={() => { logout(); navigate("/"); }}>
        <LogOut size={18} aria-hidden />
        Выйти из аккаунта
      </button>
    </main>
  );
}
