"""Статус отклика «отозван».

Revision ID: 0002
Revises: 0001
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'withdrawn'")


def downgrade() -> None:
    # Удалить значение из enum в Postgres нельзя без пересоздания типа.
    # Откатываем данные: отозванные отклики считаем отклонёнными.
    op.execute("UPDATE applications SET status = 'declined' WHERE status = 'withdrawn'")
