import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',port:5201,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:8774',changeOrigin:true}}},preview:{host:'127.0.0.1',port:5211,strictPort:true,proxy:{'/agent-trust/api':{target:'http://127.0.0.1:8774',changeOrigin:true,rewrite:path=>path.replace('/agent-trust/api','/api')}}},build:{outDir:'dist',sourcemap:false}});
