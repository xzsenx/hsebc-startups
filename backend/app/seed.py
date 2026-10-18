"""Демо-данные для проверки: запускается при старте, если база пустая."""

from sqlalchemy import func, select

from app.config import get_settings
from app.database import SessionLocal
from app.models import Application, ApplicationStatus, Post, PostKind, PostStatus, User
from app.security import hash_password

USERS = [
    ("anna@hsebc-demo.ru", "Анна Ковалёва", "Основатель, фудтех", "@anna_demo"),
    ("maks@hsebc-demo.ru", "Максим Орлов", "Бэкенд-разработчик, 3 курс ПИ", "@maks_demo"),
    ("dasha@hsebc-demo.ru", "Дарья Лебедева", "Продуктовый дизайнер", "@dasha_demo"),
    ("ilya@hsebc-demo.ru", "Илья Семёнов", "Аналитик, ищу команду", "@ilya_demo"),
]

POSTS = [
    (0, PostKind.startup, "Сервис доставки готовых рационов для студентов",
     "Запустили пилот в двух общежитиях, 120 заказов в неделю. Ищем технического партнёра.",
     "Работаем через телеграм-бота, хотим собственное приложение и автоматизацию кухни.",
     "Технический сооснователь: бэкенд и мобильный клиент. Доля обсуждается."),
    (0, PostKind.vacancy, "Нужен фронтенд-разработчик в фудтех-пилот",
     "Подработка на 10 часов в неделю, оплачиваемая.",
     "Нужно собрать личный кабинет курьера: список заказов, статусы, карта.",
     "React, TypeScript. Опыт коммерческой разработки не обязателен."),
    (2, PostKind.startup, "Маркетплейс репетиторов с проверкой квалификации",
     "MVP на стадии прототипа, есть 30 интервью с преподавателями.",
     "Главная идея — верификация: диплом, пробный урок, отзывы с подтверждённой покупкой.",
     "Ищу разработчика и человека с опытом в образовании."),
    (3, PostKind.vacancy, "Ищу напарника на хакатон по финтеху",
     "Хакатон через три недели, команда 2 из 4.",
     "Задача от банка: антифрод на транзакциях. У меня аналитика и ML, нужен бэкенд и фронт.",
     "Python или Go, умение быстро собирать прототип."),
]


def seed() -> None:
    settings = get_settings()
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(User)):
            return

        users = [
            User(
                email=email,
                password_hash=hash_password(settings.seed_password),
                name=name,
                headline=headline,
                telegram=telegram,
                bio="Демо-аккаунт для проверки прототипа.",
            )
            for email, name, headline, telegram in USERS
        ]
        db.add_all(users)
        db.flush()

        posts = [
            Post(
                author_id=users[author].id,
                kind=kind,
                title=title,
                summary=summary,
                description=description,
                looking_for=looking_for,
                status=PostStatus.open,
            )
            for author, kind, title, summary, description, looking_for in POSTS
        ]
        db.add_all(posts)
        db.flush()

        db.add_all(
            [
                Application(
                    post_id=posts[0].id,
                    applicant_id=users[1].id,
                    message="Делал два похожих сервиса, могу взять бэкенд. Расскажите про экономику пилота?",
                    status=ApplicationStatus.pending,
                ),
                Application(
                    post_id=posts[2].id,
                    applicant_id=users[1].id,
                    message="Интересна верификация преподавателей. Готов обсудить формат участия.",
                    status=ApplicationStatus.accepted,
                ),
            ]
        )
        db.commit()


if __name__ == "__main__":
    seed()
