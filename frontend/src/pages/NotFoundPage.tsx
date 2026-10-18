import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/ui";
import { usePage } from "../lib/hooks";

export default function NotFoundPage() {
  const heading = usePage("Страница не найдена");
  return (
    <main id="main" className="main main--reading">
      <h1 className="sr-only" ref={heading} tabIndex={-1} data-route-focus>
        Страница не найдена
      </h1>
      <EmptyState
        icon={Compass}
        title="Такой страницы нет"
        hint="Возможно, ссылка устарела. Начните с ленты — там все открытые публикации."
        action={<Link to="/" className="btn btn--primary">Открыть ленту</Link>}
      />
    </main>
  );
}
