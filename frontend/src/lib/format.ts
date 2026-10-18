const relative = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
const absolute = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const absoluteWithYear = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

/** «сегодня», «вчера», «3 дня назад», дальше недели — дата. */
export function formatWhen(value: string): string {
  const date = new Date(value);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (days >= 0 && days < 7) return relative.format(-days, "day");
  return date.getFullYear() === new Date().getFullYear() ? absolute.format(date) : absoluteWithYear.format(date);
}

const pluralRules = new Intl.PluralRules("ru");

/** plural(3, ["отклик", "отклика", "откликов"]) → «3 отклика» */
export function plural(count: number, forms: [one: string, few: string, many: string]): string {
  const rule = pluralRules.select(count);
  const form = rule === "one" ? forms[0] : rule === "few" ? forms[1] : forms[2];
  return `${count} ${form}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Стабильный оттенок аватара по имени — один и тот же человек всегда одного цвета. */
export function avatarHue(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 360;
}

/** Ссылка на Telegram из ника. Ник валидирован сервером: только [A-Za-z0-9_]. */
export function telegramUrl(handle: string): string {
  return `https://t.me/${encodeURIComponent(handle.replace(/^@/, ""))}`;
}
