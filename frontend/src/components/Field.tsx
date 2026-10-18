import { AlertCircle, Eye, EyeOff } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
  type TextareaHTMLAttributes,
} from "react";

interface BaseProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  maxLength?: number;
  value: string;
}

type InputProps = BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, "value"> & { multiline?: false };
type AreaProps = BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> & { multiline: true };

/** Поле с видимой подписью, подсказкой, счётчиком и ошибкой под полем.
    Всё связано через aria-describedby — диктор зачитает подсказку и ошибку. */
export function Field(props: InputProps | AreaProps) {
  const { label, error, hint, required, maxLength, value, multiline, id: idProp, ...rest } = props;
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const over = maxLength !== undefined && value.length > maxLength;
  const showCounter = maxLength !== undefined && value.length > maxLength * 0.6;

  const common = {
    id,
    value,
    className: "input",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    "aria-required": required || undefined,
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="field__required" aria-hidden>
            *
          </span>
        )}
      </label>
      {multiline ? (
        <textarea {...common} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input {...common} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {error && (
        <p className="field__error" id={errorId}>
          <AlertCircle size={15} aria-hidden />
          {error}
        </p>
      )}
      {(hint || showCounter) && (
        <div className="field__row">
          {hint && <span id={hintId}>{hint}</span>}
          {showCounter && (
            <span className={`field__counter ${over ? "field__counter--over" : ""}`} aria-live="polite">
              {value.length}/{maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function PasswordField(props: Omit<InputProps, "type" | "multiline">) {
  const { label, error, hint, required, value, id: idProp, ...rest } = props;
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="field__required" aria-hidden>
            *
          </span>
        )}
      </label>
      <div className="input-wrap">
        <input
          {...rest}
          id={id}
          value={value}
          type={visible ? "text" : "password"}
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
        />
        <button
          type="button"
          className="input-wrap__action"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>
      {error && (
        <p className="field__error" id={errorId}>
          <AlertCircle size={15} aria-hidden />
          {error}
        </p>
      )}
      {hint && (
        <div className="field__row">
          <span id={hintId}>{hint}</span>
        </div>
      )}
    </div>
  );
}

/** Ставит фокус на первое поле с ошибкой после неудачной отправки (WCAG 3.3.1). */
export function focusFirstError(form: HTMLFormElement | null) {
  const target = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (!target) return;
  // Мгновенно, а не плавно: пока шла бы анимация, под полями появляются тексты ошибок,
  // вёрстка сдвигается и плавная прокрутка проезжает мимо нужного поля.
  target.scrollIntoView({ block: "center", behavior: "instant" });
  target.focus({ preventScroll: true });
}

/** Фокус на первое ошибочное поле — после того, как React применил ошибки к DOM.
    Эффект надёжнее requestAnimationFrame: тот не срабатывает в неотрисовываемой вкладке
    и может выполниться раньше, чем появятся атрибуты aria-invalid. */
export function useErrorFocus(formRef: RefObject<HTMLFormElement | null>) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (attempt) focusFirstError(formRef.current);
  }, [attempt, formRef]);
  return useCallback(() => setAttempt((n) => n + 1), []);
}
