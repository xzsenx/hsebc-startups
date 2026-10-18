/* Клиентская проверка повторяет серверную: пользователь видит ошибку сразу у поля,
   но источник правды — сервер, клиенту доверять нельзя. */

export type Rule = (value: string) => string | null;

export const rules = {
  required:
    (message = "Обязательное поле"): Rule =>
    (v) =>
      v.trim() ? null : message,
  minLength:
    (n: number): Rule =>
    (v) =>
      !v.trim() || v.trim().length >= n ? null : `Минимум ${n} симв.`,
  maxLength:
    (n: number): Rule =>
    (v) =>
      v.length <= n ? null : `Максимум ${n} симв.`,
  email: (): Rule => (v) =>
    !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : "Проверьте адрес почты, например name@mail.ru",
  passwordBytes: (): Rule => (v) =>
    new TextEncoder().encode(v).length <= 72 ? null : "Слишком длинный пароль: до 72 байт (≈36 символов кириллицей)",
  telegram: (): Rule => (v) => {
    const nick = v.trim().replace(/^https:\/\/t\.me\//, "").replace(/^@/, "");
    if (!nick) return null;
    return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(nick) ? null : "5–32 символа: латиница, цифры, подчёркивание";
  },
};

export function validate<T extends Record<string, string>>(
  values: T,
  schema: Partial<Record<keyof T, Rule[]>>,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  for (const key of Object.keys(schema) as (keyof T)[]) {
    for (const rule of schema[key] ?? []) {
      const error = rule(values[key] ?? "");
      if (error) {
        errors[key] = error;
        break;
      }
    }
  }
  return errors;
}

/** Внутренний путь для редиректа после входа. Всё остальное — на главную:
    иначе ?next=//evil.com превращает форму входа в открытый редирект. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
