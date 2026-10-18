import { ArrowLeft, BriefcaseBusiness, Rocket } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Field, useErrorFocus } from "../components/Field";
import { Alert, EmptyState, Spinner } from "../components/ui";
import { ApiError, api, type Kind, type PostPayload } from "../lib/api";
import { useAuth } from "../lib/auth";
import { usePage } from "../lib/hooks";
import { haptic } from "../lib/telegram";
import { useToast } from "../lib/toast";
import { rules, validate } from "../lib/validation";

type Values = Omit<PostPayload, "kind">;

const LIMITS = { title: 160, summary: 280, description: 5000, looking_for: 2000 };

const SCHEMA = {
  title: [rules.required("Придумайте заголовок"), rules.minLength(4), rules.maxLength(LIMITS.title)],
  summary: [rules.maxLength(LIMITS.summary)],
  description: [rules.maxLength(LIMITS.description)],
  looking_for: [rules.required("Напишите, кого ищете — это главное в публикации"), rules.minLength(3), rules.maxLength(LIMITS.looking_for)],
};

const COPY: Record<Kind, { title: string; looking: string; description: string; hint: string }> = {
  startup: {
    title: "Например: сервис доставки рационов для студентов",
    looking: "Например: технический сооснователь — бэкенд и мобильный клиент, доля обсуждается",
    description: "Стадия, что уже сделано, какие есть цифры, чем проект интересен",
    hint: "Ищете сооснователей и команду в свой проект",
  },
  vacancy: {
    title: "Например: фронтенд-разработчик в фудтех-пилот",
    looking: "Например: React и TypeScript, 10 часов в неделю, коммерческий опыт не обязателен",
    description: "Задачи, формат и условия: оплата, доля, сроки",
    hint: "Нужен человек на конкретную роль или задачу",
  },
};

const EMPTY: Values = { title: "", summary: "", description: "", looking_for: "" };

export default function PostFormPage() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const isEdit = editId !== null;
  const heading = usePage(isEdit ? "Редактирование" : "Новая публикация");
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshSummary } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const focusErrors = useErrorFocus(formRef);

  const [kind, setKind] = useState<Kind>("startup");
  const [values, setValues] = useState<Values>(EMPTY);
  const [initial, setInitial] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!isEdit || !editId) return;
    api
      .post(editId)
      .then((post) => {
        if (!post.is_mine) {
          setForbidden(true);
          return;
        }
        const loaded = { title: post.title, summary: post.summary, description: post.description, looking_for: post.looking_for };
        setKind(post.kind);
        setValues(loaded);
        setInitial(loaded);
      })
      .catch(() => setForbidden(true))
      .finally(() => setLoading(false));
  }, [isEdit, editId]);

  const clientErrors = validate(values, SCHEMA);
  // Ошибку показываем после того, как человек ушёл с поля, а не на каждую букву.
  const errorFor = (field: keyof Values) => serverErrors[field] ?? (touched[field] ? clientErrors[field] : undefined);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  // Предупреждение при закрытии вкладки с несохранённым текстом.
  useEffect(() => {
    if (!dirty || busy) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, busy]);

  const bind = (field: keyof Values) => ({
    value: values[field],
    maxLength: LIMITS[field],
    error: errorFor(field),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
      setServerErrors((s) => ({ ...s, [field]: undefined }));
    },
    onBlur: () => setTouched((t) => ({ ...t, [field]: true })),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ title: true, summary: true, description: true, looking_for: true });
    setFormError("");
    if (Object.keys(clientErrors).length) {
      // Ждём перерисовки с aria-invalid и ставим фокус на первое ошибочное поле.
      focusErrors();
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: values.title.trim(),
        summary: values.summary.trim(),
        description: values.description.trim(),
        looking_for: values.looking_for.trim(),
      };
      const post = isEdit && editId ? await api.updatePost(editId, payload) : await api.createPost({ ...payload, kind });
      haptic.success();
      toast(isEdit ? "Изменения сохранены" : "Публикация размещена в ленте");
      setInitial(values);
      void refreshSummary();
      navigate(`/posts/${post.id}`, { replace: isEdit });
    } catch (err) {
      haptic.error();
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setServerErrors(err.fields as Partial<Record<keyof Values, string>>);
        focusErrors();
      } else {
        setFormError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <main id="main" className="main main--reading">
        <EmptyState
          icon={BriefcaseBusiness}
          title="Нельзя изменить эту публикацию"
          hint="Редактировать публикацию может только её автор."
          action={<Link to="/" className="btn btn--primary">В ленту</Link>}
        />
      </main>
    );
  }

  const copy = COPY[kind];

  return (
    <main id="main" className="main main--reading">
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} aria-hidden />
        Назад
      </button>

      <div className="page-head">
        <div>
          <h1 className="page-head__title" ref={heading} tabIndex={-1} data-route-focus>
            {isEdit ? "Редактирование" : "Новая публикация"}
          </h1>
          <p className="page-head__lead">
            Поля со звёздочкой обязательны. Контакты в тексте оставлять не нужно — они откроются, когда вы примете отклик.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", minHeight: 200 }}>
          <Spinner label="Загружаем публикацию" />
        </div>
      ) : (
        <form ref={formRef} className="form" onSubmit={submit} noValidate>
          {!isEdit && (
            <fieldset className="kind-picker">
              <legend className="field__label" style={{ marginBottom: 8, gridColumn: "1 / -1" }}>
                Что публикуете
              </legend>
              {(["startup", "vacancy"] as const).map((value) => {
                const Icon = value === "startup" ? Rocket : BriefcaseBusiness;
                return (
                  <label key={value} className="kind-option">
                    <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                    <span className="kind-option__title">
                      <Icon size={18} aria-hidden />
                      {value === "startup" ? "Стартап" : "Вакансия"}
                    </span>
                    <span className="kind-option__hint">{COPY[value].hint}</span>
                  </label>
                );
              })}
            </fieldset>
          )}

          <Field label="Заголовок" required placeholder={copy.title} autoComplete="off" {...bind("title")} />
          <Field
            multiline
            rows={3}
            label="Кого ищете"
            required
            placeholder={copy.looking}
            hint="Роль, навыки, формат участия"
            {...bind("looking_for")}
          />
          <Field label="Коротко" placeholder="Одно предложение — его увидят в ленте" hint="Подзаголовок карточки в ленте" {...bind("summary")} />
          <Field multiline rows={6} label="Подробности" placeholder={copy.description} {...bind("description")} />

          {formError && <Alert tone="error">{formError}</Alert>}

          <div className="form-actions">
            <button type="submit" className="btn btn--primary btn--lg" disabled={busy || (isEdit && !dirty)} aria-busy={busy}>
              {busy && <Spinner />}
              {busy ? "Сохраняем…" : isEdit ? "Сохранить изменения" : "Опубликовать"}
            </button>
            <button type="button" className="btn btn--ghost btn--lg" onClick={() => navigate(-1)} disabled={busy}>
              Отмена
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
