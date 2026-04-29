"""add_registration_number

Revision ID: b3c4d5e6f7g8
Revises: a1b2c3d4e5f6
Create Date: 2026-04-29 04:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7g8'
down_revision: Union[str, Sequence[str]] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add registration_number column to Students table."""
    op.execute("""
        ALTER TABLE Students ADD COLUMN IF NOT EXISTS registration_number TEXT DEFAULT '';
    """)


def downgrade() -> None:
    """Remove registration_number column from Students table."""
    op.execute("""
        ALTER TABLE Students DROP COLUMN IF EXISTS registration_number;
    """)
