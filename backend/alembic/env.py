from alembic import context
from sqlalchemy import engine_from_config,pool
from app.config import get_settings
from app.database import Base
from app.models import *
config=context.config; config.set_main_option("sqlalchemy.url",get_settings().database_url)
def run_migrations_online():
 with engine_from_config(config.get_section(config.config_ini_section),prefix="sqlalchemy.",poolclass=pool.NullPool).connect() as connection:
  context.configure(connection=connection,target_metadata=Base.metadata,compare_type=True); 
  with context.begin_transaction(): context.run_migrations()
run_migrations_online()
