import re
def normalize_inn(value:str|None)->str: return re.sub(r"\D","",value or "")
def normalize_number(value:str)->str: return re.sub(r"[^0-9a-zа-я]","",value.casefold())
