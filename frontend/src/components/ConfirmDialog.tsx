import { useEffect, useId, useRef, type ReactNode } from "react";

import { Spinner } from "./ui";

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Подтверждение необратимых действий. Нативный <dialog> в модальном режиме сам
    удерживает фокус внутри, закрывается по Esc и возвращает фокус на кнопку-триггер. */
export function ConfirmDialog({ open, title, children, confirmLabel, tone = "primary", busy, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Уникальный id: на странице может быть несколько диалогов, дубли сломали бы aria-labelledby.
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Фокус на безопасную кнопку: случайный Enter не подтвердит удаление.
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      onClick={(e) => {
        // Клик по подложке (вне содержимого) закрывает диалог.
        if (e.target === ref.current && !busy) onCancel();
      }}
    >
      <div className="dialog__body">
        <h2 id={titleId} className="dialog__title">
          {title}
        </h2>
        {children && <div className="dialog__text">{children}</div>}
      </div>
      <div className="dialog__actions">
        <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
        <button
          type="button"
          className={`btn ${tone === "danger" ? "btn--danger-solid" : "btn--primary"}`}
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
        >
          {busy && <Spinner />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
