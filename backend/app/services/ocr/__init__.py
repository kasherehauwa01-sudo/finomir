from .disabled import DisabledOCRProvider
from .parser import RussianInvoiceParser


def get_provider(name:str): return DisabledOCRProvider()


__all__ = ["RussianInvoiceParser", "get_provider"]
