import hashlib, uuid
from pathlib import Path
ALLOWED={"application/pdf":".pdf","image/jpeg":".jpg","image/png":".png"}
def validate_file(name:str,mime:str,size:int,max_mb:int)->str:
 ext=Path(name).suffix.lower()
 if mime not in ALLOWED or ext not in ({".jpg",".jpeg"} if mime=="image/jpeg" else {ALLOWED.get(mime)}): raise ValueError("Разрешены только PDF, JPG/JPEG и PNG")
 if size<=0 or size>max_mb*1024*1024: raise ValueError(f"Размер файла должен быть не более {max_mb} МБ")
 return ALLOWED[mime]
def save_bytes(data:bytes,name:str,mime:str,directory:Path,max_mb:int):
 ext=validate_file(name,mime,len(data),max_mb); directory.mkdir(parents=True,exist_ok=True); stored=f"{uuid.uuid4().hex}{ext}"; path=(directory/stored).resolve()
 if directory.resolve() not in path.parents: raise ValueError("Недопустимый путь")
 path.write_bytes(data); return stored,str(path),hashlib.sha256(data).hexdigest()
