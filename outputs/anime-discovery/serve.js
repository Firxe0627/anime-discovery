/* ==========================================================================
   serve.js —— 零依赖本地静态服务器（只用于本地预览）
   用法： node serve.js        然后打开 http://localhost:8080/
         node serve.js 9000   指定端口
   注意：这只是把当前文件夹里的静态文件发给浏览器，没有后端逻辑、没有接口、无外网请求。
   ========================================================================== */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8080;
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, `http://${HOST}:${PORT}`).pathname);
  } catch (e) {
    return send(res, 400, 'Bad Request');
  }

  if (urlPath === '/') { urlPath = '/index.html'; }

  // 阻止目录穿越：解析后必须仍在 ROOT 之内
  const target = path.resolve(ROOT, '.' + urlPath);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'Forbidden');
  }

  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, '404 Not Found — 请检查路径，或回到 / 首页。');
    }
    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`番组发现 本地预览已启动：http://localhost:${PORT}/`);
  console.log('按 Ctrl+C 结束。');
});
