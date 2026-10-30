// Servidor estático mínimo, sin dependencias: `node server.js` y abre http://localhost:3000
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, 'app');
const PORT = Number(process.env.PORT) || 3000;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function crearServidor() {
  return http.createServer((req, res) => {
    let ruta;
    try { ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Solicitud inválida'); }
    const archivo = path.normalize(path.join(APP, ruta === '/' ? 'index.html' : ruta));
    if (!archivo.startsWith(APP + path.sep)) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Prohibido'); }
    fs.readFile(archivo, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

if (require.main === module) {
  const srv = crearServidor();
  srv.on('error', e => {
    if (e.code === 'EADDRINUSE') console.error(`El puerto ${PORT} está ocupado. Prueba con otro: PORT=3001 node server.js (en PowerShell: $env:PORT=3001; node server.js)`);
    else console.error(e.message);
    process.exit(1);
  });
  srv.listen(PORT, () => console.log(`Vethub en http://localhost:${PORT}  (Ctrl+C para detener)`));
}

module.exports = { crearServidor };
