import uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from .base import SoftDeleteMixin, TimestampMixin, UUIDMixin

class Partner(Base,UUIDMixin,TimestampMixin,SoftDeleteMixin):
 __tablename__="partners"; name:Mapped[str]=mapped_column(String(255),index=True); comment:Mapped[str|None]=mapped_column(Text)
 counterparties:Mapped[list["Counterparty"]]=relationship(back_populates="partner")
class Counterparty(Base,UUIDMixin,TimestampMixin,SoftDeleteMixin):
 __tablename__="counterparties"; partner_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("partners.id"),index=True); full_name:Mapped[str]=mapped_column(String(500)); short_name:Mapped[str|None]=mapped_column(String(255)); entity_type:Mapped[str]=mapped_column(String(30)); inn:Mapped[str|None]=mapped_column(String(12),index=True); kpp:Mapped[str|None]=mapped_column(String(9)); comment:Mapped[str|None]=mapped_column(Text); partner:Mapped[Partner]=relationship(back_populates="counterparties")
class Tag(Base,UUIDMixin,TimestampMixin):
 __tablename__="tags"; name:Mapped[str]=mapped_column(String(100),unique=True)
class Store(Base,UUIDMixin,TimestampMixin):
 __tablename__="stores"; name:Mapped[str]=mapped_column(String(255),unique=True); address:Mapped[str|None]=mapped_column(Text); comment:Mapped[str|None]=mapped_column(Text); is_active:Mapped[bool]=mapped_column(Boolean,default=True); is_system:Mapped[bool]=mapped_column(Boolean,default=False)
class ExpenseTag(Base):
 __tablename__="expense_tags"; expense_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("expenses.id"),primary_key=True); tag_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("tags.id"),primary_key=True)
class Expense(Base,UUIDMixin,TimestampMixin,SoftDeleteMixin):
 __tablename__="expenses"; partner_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("partners.id"),index=True); counterparty_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("counterparties.id"),index=True); service_name:Mapped[str]=mapped_column(String(500)); contract_number:Mapped[str|None]=mapped_column(String(100)); contract_date:Mapped[date|None]=mapped_column(Date); expense_month:Mapped[int]=mapped_column(Integer); expense_year:Mapped[int]=mapped_column(Integer); comment:Mapped[str|None]=mapped_column(Text)
 partner:Mapped[Partner]=relationship(); counterparty:Mapped[Counterparty]=relationship(); invoices:Mapped[list["Invoice"]]=relationship(back_populates="expense",cascade="save-update"); tags:Mapped[list[Tag]]=relationship(secondary="expense_tags"); allocations:Mapped[list["Allocation"]]=relationship(cascade="all, delete-orphan"); comments:Mapped[list["Comment"]]=relationship(cascade="all, delete-orphan")
 __table_args__=(CheckConstraint("expense_month between 1 and 12"),CheckConstraint("expense_year between 2000 and 2200"),Index("ix_expenses_period","expense_year","expense_month"))
class Invoice(Base,UUIDMixin,TimestampMixin,SoftDeleteMixin):
 __tablename__="invoices"; expense_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("expenses.id"),index=True); invoice_number:Mapped[str]=mapped_column(String(100),index=True); invoice_date:Mapped[date]=mapped_column(Date,index=True); amount:Mapped[Decimal]=mapped_column(Numeric(15,2)); vat_amount:Mapped[Decimal|None]=mapped_column(Numeric(15,2)); comment:Mapped[str|None]=mapped_column(Text); expense:Mapped[Expense]=relationship(back_populates="invoices"); payments:Mapped[list["Payment"]]=relationship(back_populates="invoice")
 __table_args__=(CheckConstraint("amount >= 0"),CheckConstraint("vat_amount is null or vat_amount >= 0"),Index("ix_invoice_duplicate","invoice_number","invoice_date","amount"))
class Payment(Base,UUIDMixin,TimestampMixin,SoftDeleteMixin):
 __tablename__="payments"; invoice_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("invoices.id"),index=True); payment_date:Mapped[date]=mapped_column(Date,index=True); amount:Mapped[Decimal]=mapped_column(Numeric(15,2)); comment:Mapped[str|None]=mapped_column(Text); invoice:Mapped[Invoice]=relationship(back_populates="payments"); __table_args__=(CheckConstraint("amount >= 0"),)
class Allocation(Base,UUIDMixin):
 __tablename__="expense_store_allocations"; expense_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("expenses.id"),index=True); store_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("stores.id"),index=True); amount:Mapped[Decimal]=mapped_column(Numeric(15,2)); store:Mapped[Store]=relationship(); __table_args__=(UniqueConstraint("expense_id","store_id"),CheckConstraint("amount >= 0"))
class Document(Base,UUIDMixin,SoftDeleteMixin):
 __tablename__="documents"; expense_id:Mapped[uuid.UUID|None]=mapped_column(ForeignKey("expenses.id"),index=True); invoice_id:Mapped[uuid.UUID|None]=mapped_column(ForeignKey("invoices.id"),index=True); payment_id:Mapped[uuid.UUID|None]=mapped_column(ForeignKey("payments.id"),index=True); document_type:Mapped[str]=mapped_column(String(20)); original_filename:Mapped[str]=mapped_column(String(500)); stored_filename:Mapped[str]=mapped_column(String(100),unique=True); storage_path:Mapped[str]=mapped_column(String(500)); mime_type:Mapped[str]=mapped_column(String(100)); file_size:Mapped[int]=mapped_column(); sha256:Mapped[str]=mapped_column(String(64),index=True); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True))
class OCRRecognition(Base,UUIDMixin):
 __tablename__="ocr_results"; document_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("documents.id"),index=True); provider:Mapped[str]=mapped_column(String(30)); raw_text:Mapped[str]=mapped_column(Text); fields:Mapped[dict]=mapped_column(JSONB); confidence:Mapped[dict]=mapped_column(JSONB); blocks:Mapped[list]=mapped_column(JSONB); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True))
class Comment(Base,UUIDMixin):
 __tablename__="comments"; expense_id:Mapped[uuid.UUID]=mapped_column(ForeignKey("expenses.id"),index=True); text:Mapped[str]=mapped_column(Text); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True))
class AuditLog(Base,UUIDMixin):
 __tablename__="audit_log"; entity_type:Mapped[str]=mapped_column(String(50),index=True); entity_id:Mapped[uuid.UUID]=mapped_column(index=True); action:Mapped[str]=mapped_column(String(50)); field_name:Mapped[str|None]=mapped_column(String(100)); old_value:Mapped[str|None]=mapped_column(Text); new_value:Mapped[str|None]=mapped_column(Text); metadata_:Mapped[dict|None]=mapped_column("metadata",JSONB); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True))
class SavedFilter(Base,UUIDMixin,TimestampMixin):
 __tablename__="saved_filters"; name:Mapped[str]=mapped_column(String(255),unique=True); filter_config:Mapped[dict]=mapped_column(JSONB)
