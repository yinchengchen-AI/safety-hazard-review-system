"""add_user_is_active

Revision ID: b60c4e7f9a1d
Revises: a550bdcff698
Create Date: 2026-06-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b60c4e7f9a1d'
down_revision: Union[str, Sequence[str], None] = 'a550bdcff698'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_active column to users table."""
    op.add_column(
        'users',
        sa.Column(
            'is_active',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('true'),
        ),
    )


def downgrade() -> None:
    """Remove is_active column from users table."""
    op.drop_column('users', 'is_active')
