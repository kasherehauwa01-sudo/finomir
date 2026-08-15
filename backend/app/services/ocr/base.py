from abc import ABC,abstractmethod
from dataclasses import dataclass,field
from decimal import Decimal
@dataclass
class OCRResult:
 counterparty_name:str|None=None; inn:str|None=None; kpp:str|None=None; contract_number:str|None=None; contract_date:str|None=None; invoice_number:str|None=None; invoice_date:str|None=None; invoice_amount:Decimal|None=None; vat_amount:Decimal|None=None; service_name:str|None=None; service_period:dict=field(default_factory=lambda:{"month":None,"year":None}); confidence:dict=field(default_factory=dict)
class OCRProvider(ABC):
 @abstractmethod
 def recognize(self,path:str,mime:str)->OCRResult: ...
