import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const server=http.createServer(async(req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname;
 if(route==='/'){res.writeHead(302,{Location:'/tests/work-control-harness.html'});return res.end()}
 if(!['/tests/work-control-harness.html','/index.html','/public-assets/work-control-v1.css','/public-assets/work-control-core-v1.js','/public-assets/work-control-sync-v1.js','/public-assets/work-control-v1.js'].includes(route)){res.writeHead(404);return res.end('Somente a prévia fictícia está disponível.')}
 try{const file=path.join(root,route);res.setHeader('Content-Type',route.endsWith('.js')?'text/javascript; charset=utf-8':route.endsWith('.css')?'text/css; charset=utf-8':route==='/index.html'?'text/plain; charset=utf-8':'text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(await fs.readFile(file))}catch{res.writeHead(404);res.end('Arquivo não encontrado')}
});
server.listen(0,'127.0.0.1',()=>console.log(`PREVIEW_LOCAL=http://127.0.0.1:${server.address().port}/tests/work-control-harness.html`));
