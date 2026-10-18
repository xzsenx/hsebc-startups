import {
  AlertCircle,
  Ban,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Info,
  Lock,
  Rocket,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import type { ApplicationStatus, Kind } from "../lib/api";
import { avatarHue, initials } from "../lib/format";

export const KIND: Record<Kind, { label: string; icon: LucideIcon }> = {
  startup: { label: "Стартап", icon: Rocket },
  vacancy: { label: "Вакансия", icon: BriefcaseBusiness },
};

export const APPLICATION: Record<ApplicationStatus, { label: string; icon: LucideIcon }> = {
  pending: { label: "На рассмотрении", icon: Clock3 },
  accepted: { label: "Принят", icon: CheckCircle2 },
  declined: { label: "Отклонён", icon: Ban },
  withdrawn: { label: "Отозван", icon: Undo2 },
};

export function KindBadge({ kind }: { kind: Kind }) {
  const { label, icon: Icon } = KIND[kind];
  return (
    <span className={`badge badge--${kind}`}>
      <Icon size={14} aria-hidden />
      {label}
    </span>
  );
}

export function StatusBadge({ status, prefix }: { status: ApplicationStatus; prefix?: string }) {
  const { label, icon: Icon } = APPLICATION[status];
  return (
    <span className={`badge badge--${status}`}>
      <Icon size={14} aria-hidden />
      {prefix ? `${prefix}: ${label.toLowerCase()}` : label}
    </span>
  );
}

export function ClosedBadge() {
  return (
    <span className="badge badge--closed">
      <Lock size={13} aria-hidden />
      Набор закрыт
    </span>
  );
}

export function Avatar({ name, size }: { name: string; size?: "sm" | "lg" }) {
  return (
    <span
      className={`avatar ${size ? `avatar--${size}` : ""}`}
      style={{ "--h": avatarHue(name) } as CSSProperties}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Person({ name, headline, size }: { name: string; headline?: string; size?: "sm" | "lg" }) {
  return (
    <div className="person">
      <Avatar name={name} size={size} />
      <div>
        <div className="person__name">{name}</div>
        {headline && <div className="person__headline">{headline}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <>
      <span className="spinner" aria-hidden />
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon size={24} aria-hidden />
      </span>
      <p className="empty__title">{title}</p>
      {hint && <p className="empty__hint">{hint}</p>}
      {action}
    </div>
  );
}

const ALERT_ICON = { error: AlertCircle, success: CheckCircle2, info: Info, neutral: Info, warning: AlertCircle };

export function Alert({
  tone,
  title,
  children,
  action,
}: {
  tone: keyof typeof ALERT_ICON;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = ALERT_ICON[tone];
  return (
    // Ошибки объявляются диктору сразу (role=alert), остальное — вежливо.
    <div className={`alert alert--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon size={18} aria-hidden />
      <div className="alert__body">
        {title && <p className="alert__title">{title}</p>}
        {children && <div>{children}</div>}
        {action}
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid--2" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="skeleton" style={{ width: 92, height: 26, borderRadius: 999 }} />
          <div className="skeleton" style={{ width: "85%", height: 22 }} />
          <div className="skeleton" style={{ width: "100%", height: 14 }} />
          <div className="skeleton" style={{ width: "70%", height: 14 }} />
          <div className="skeleton" style={{ width: "100%", height: 40, marginTop: 4 }} />
          <div className="skeleton" style={{ width: "50%", height: 14, marginTop: "auto" }} />
        </div>
      ))}
    </div>
  );
}
