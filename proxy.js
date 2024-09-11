var environment = process.argv[2];
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

const httpProxy = require('http-proxy');
const server = httpProxy.createProxyServer({
  secure: false,
  target: {
    protocol: 'https:',
    host: host[environment],
    port: 443
  },
  changeOrigin: true
});
server.listen(port);
console.log(`Started proxy server for ${host[environment]} on port ${port}`);
