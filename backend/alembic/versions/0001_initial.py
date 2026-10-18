"""Начальная схема: пользователи, публикации, отклики.

Revision ID: 0001
Revises:
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

post_kind = sa.Enum("startup", "vacancy", name="post_kind")
post_status = sa.Enum("open", "closed", name="post_status")
application_status = sa.Enum("pending", "accepted", "declined", name="application_status")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("headline", sa.String(160), nullable=False, server_default=""),
        sa.Column("bio", sa.Text, nullable=False, server_default=""),
        sa.Column("telegram", sa.String(64), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "posts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("author_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", post_kind, nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("summary", sa.String(280), nullable=False, server_default=""),
        sa.Column("description", sa.Text, nullable=False, server_default=""),
        sa.Column("looking_for", sa.Text, nullable=False, server_default=""),
        sa.Column("status", post_status, nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_posts_author_id", "posts", ["author_id"])
    op.create_index("ix_posts_kind", "posts", ["kind"])
    op.create_index("ix_posts_status", "posts", ["status"])
    op.create_index("ix_posts_feed", "posts", ["status", "created_at"])

    op.create_table(
        "applications",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("post_id", sa.Integer, sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("applicant_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message", sa.Text, nullable=False, server_default=""),
        sa.Column("status", application_status, nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("post_id", "applicant_id", name="uq_application_once"),
    )
    op.create_index("ix_applications_post_id", "applications", ["post_id"])
    op.create_index("ix_applications_applicant_id", "applications", ["applicant_id"])
    op.create_index("ix_applications_status", "applications", ["status"])


def downgrade() -> None:
    op.drop_table("applications")
    op.drop_table("posts")
    op.drop_table("users")
    application_status.drop(op.get_bind(), checkfirst=True)
    post_status.drop(op.get_bind(), checkfirst=True)
    post_kind.drop(op.get_bind(), checkfirst=True)
