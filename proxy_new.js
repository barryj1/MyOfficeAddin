const cors = require('cors');
const express = require('express');
const httpProxy = require('http-proxy');

const app = express();
const port = process.argv[3] || 5002;

const host = {
  dev: 'dav.dev.uspto.gov',
  dev2: 'dav2.dev.uspto.gov',
  dev3: 'dav3.dev.uspto.gov',
  sit: 'dav.sit.uspto.gov',
  fqt: 'dav.fqt.uspto.gov',
  fqt2: 'dav2.fqt.uspto.gov',
  fqt3: 'dav3.fqt.uspto.gov',
  pvt: 'eti.pvt.uspto.gov',
  prod: 'dav.uspto.gov'
};

const proxy = httpProxy.createProxyServer({
  secure: false,
  changeOrigin: true,
});

// app.options('*', cors());

app.use(cors({
  origin: 'https://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://localhost:3000'); 
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type', 'Authorization');
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Expose-Headers', 'Set-Cookie');
  res.cookie('pe2e.current.employeeNumber', '76665', {
    sameSite: 'None',
    secure: true,
    httpOnly: true
  });
  next();
});

app.all('/ocweb/rest/*', (req, res) => {
  console.log(`Proxying request: ${req.method} ${req.url}`);
  proxy.web(req, res, {
    target: {
      protocol: 'https:',
      host: host[process.argv[2]], 
      port: 443
    }
  });
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  res.status(500).send('Proxy error');
});

app.listen(port, () => {
  console.log(`Started proxy server for ${host[process.argv[2]]} on port ${port}`);
});