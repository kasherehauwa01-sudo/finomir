"""initial normalized schema"""
from alembic import op
from app.database import Base
from app.models import *
revision="0001"; down_revision=None
def upgrade(): Base.metadata.create_all(bind=op.get_bind()); op.execute("INSERT INTO stores (id,name,is_active,is_system,created_at,updated_at) VALUES (gen_random_uuid(),'Общий маркетинг',true,true,now(),now())")
def downgrade(): Base.metadata.drop_all(bind=op.get_bind())
