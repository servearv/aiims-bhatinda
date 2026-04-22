"""add_end_date_to_camp_requests

Revision ID: a1b2c3d4e5f6
Revises: 07eb4733d3d3
Create Date: 2026-04-22 04:37:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '07eb4733d3d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add end_date column to Camp_Requests (was missing due to schema drift)."""
    op.execute("""
        ALTER TABLE Camp_Requests
        ADD COLUMN IF NOT EXISTS end_date TEXT DEFAULT '';
    """)


def downgrade() -> None:
    """Remove end_date column from Camp_Requests."""
    op.execute("""
        ALTER TABLE Camp_Requests
        DROP COLUMN IF EXISTS end_date;
    """)
