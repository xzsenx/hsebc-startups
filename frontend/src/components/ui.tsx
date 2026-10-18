import type { ReactNode } from "react";

import type { ApplicationStatus, Kind, PostStatus } from "../lib/api";

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {hint && <p className="empty__hint">{hint}</p>}
    </div>
  );
}

export function Loader() {
  return <div className="loader">Загружаем…</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="error-box">{message}</div>;
}

const KIND_LABEL: Record<Kind, string> = { startup: "Стартап", vacancy: "Вакансия" };
const APP_LABEL: Record<ApplicationStatus, string> = {
  pending: "На рассмотрении",
  accepted: "Принят",
  declined: "Отклонён",
};

export function KindBadge({ kind }: { kind: Kind }) {
  return <span className={`badge badge--${kind}`}>{KIND_LABEL[kind]}</span>;
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`badge badge--${status}`}>{APP_LABEL[status]}</span>;
}

export function ClosedBadge({ status }: { status: PostStatus }) {
  if (status === "open") return null;
  return <span className="badge badge--closed">Закрыта</span>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="section__title">{title}</h2>
      {children}
    </section>
  );
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}
