const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8088;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const filePath = path.join(ROOT, reqPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  console.log('=====================================================');
  console.log('💖 MÁY CHỦ WEB QUIZ CỦA BÉ YÊU ĐÃ KHỞI CHẠY!');
  console.log('=====================================================');
  console.log(`\n👉 Truy cập trên máy này:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n👉 Bé yêu truy cập cùng Wi-Fi trên điện thoại/laptop:`);
  ips.forEach(ip => {
    console.log(`   http://${ip}:${PORT}`);
  });
  console.log('\n(Hãy giữ cửa sổ này mở để bé yêu truy cập được)');
  console.log('Nhấn Ctrl + C để dừng.');
  console.log('=====================================================');
});
