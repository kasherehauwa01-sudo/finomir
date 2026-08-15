declare const __BASE_PATH__:string; const base=__BASE_PATH__.replace(/\/$/,'');
export async function api<T>(path:string,options?:RequestInit):Promise<T>{const response=await fetch(`${base}/api${path}`,{...options,headers:{...(options?.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options?.headers}});if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(typeof body?.detail==='string'?body.detail:body?.detail?.message||'Не удалось выполнить операцию');}return response.status===204?undefined as T:response.json()}
export {base};
