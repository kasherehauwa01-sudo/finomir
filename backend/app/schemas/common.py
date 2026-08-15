from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator
class ORMModel(BaseModel): model_config=ConfigDict(from_attributes=True)
class MoneyModel(BaseModel):
 @field_validator("*", mode="before")
 @classmethod
 def money(cls,v):
  if isinstance(v,float): raise ValueError("Денежные значения нельзя передавать как float")
  return v
class Page(BaseModel): items:list; total:int; page:int; page_size:int
