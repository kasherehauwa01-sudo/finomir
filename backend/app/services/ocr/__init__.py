from .disabled import DisabledOCRProvider
def get_provider(name:str): return DisabledOCRProvider()
