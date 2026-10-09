/* =============================================================================
 * serve.mjs —— 零依赖静态服务器（用于打开模拟器界面）
 * 用法： node serve.mjs [端口]      默认 8099，自动挑选可用端口
 * ========================================================================== */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 ' + p); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
});

const wanted = Number(process.argv[2] || process.env.PORT || 8099);
let port = wanted;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && port < wanted + 20) { server.listen(++port); }
  else { console.error('启动失败：', e.message); process.exit(1); }
});
server.listen(port, '127.0.0.1', () => {
  console.log('STC15F2K60S2 汇编可视化模拟器已启动：');
  console.log('  http://127.0.0.1:' + port + '/');
  console.log('（关闭本窗口即停止服务）');
});
