import {defineConfig,loadEnv} from 'vite'; import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{const e=loadEnv(mode,process.cwd(),'');const base=(e.VITE_BASE_PATH||'/').replace(/\/?$/,'/');return {base,plugins:[react()],define:{__BASE_PATH__:JSON.stringify(base)}}})
