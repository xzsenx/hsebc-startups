import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ErrorBox } from "../components/ui";
import { api, type Kind } from "../lib/api";

export default function NewPostPage() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>("startup");
  const [form, setForm] = useState({ title: "", summary: "", description: "", looking_for: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [field]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const post = await api.createPost({ ...form, kind });
      navigate(`/posts/${post.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--narrow">
      <h1 className="page__title">Новая публикация</h1>

      <form className="form" onSubmit={submit}>
        <div className="tabs tabs--wide">
          <button
            type="button"
            className={`tab ${kind === "startup" ? "tab--active" : ""}`}
            onClick={() => setKind("startup")}
          >
            Стартап
          </button>
          <button
            type="button"
            className={`tab ${kind === "vacancy" ? "tab--active" : ""}`}
            onClick={() => setKind("vacancy")}
          >
            Вакансия
          </button>
        </div>

        <label className="field">
          <span className="field__label">Заголовок</span>
          <input
            className="input"
            required
            minLength={4}
            maxLength={160}
            placeholder={kind === "startup" ? "О чём ваш проект" : "Кто нужен и куда"}
            value={form.title}
            onChange={update("title")}
          />
        </label>

        <label className="field">
          <span className="field__label">Коротко</span>
          <input
            className="input"
            maxLength={280}
            placeholder="Одно предложение для ленты"
            value={form.summary}
            onChange={update("summary")}
          />
        </label>

        <label className="field">
          <span className="field__label">Подробности</span>
          <textarea
            className="input input--area"
            rows={5}
            maxLength={5000}
            placeholder="Стадия, что уже сделано, условия"
            value={form.description}
            onChange={update("description")}
          />
        </label>

        <label className="field">
          <span className="field__label">Кого ищете</span>
          <textarea
            className="input input--area"
            rows={3}
            maxLength={2000}
            placeholder="Роль, навыки, формат участия"
            value={form.looking_for}
            onChange={update("looking_for")}
          />
        </label>

        {error && <ErrorBox message={error} />}

        <button className="btn btn--primary btn--wide" disabled={busy}>
          {busy ? "Публикуем…" : "Опубликовать"}
        </button>
      </form>
    </div>
  );
}
