/**
 * Generates self-signed TLS/SSL certificate and private key for local/staging reverse proxy
 */
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

async function main() {
  const sslDir = path.join(__dirname, '../docker/nginx/ssl');

  if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
  }

  console.log('Generating self-signed TLS certificates for localhost...');

  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'countryName', value: 'US' },
    { shortName: 'ST', value: 'California' },
    { name: 'localityName', value: 'San Francisco' },
    { name: 'organizationName', value: 'Algions AI Labs' },
    { shortName: 'OU', value: 'Cloud DevOps Engineering' },
  ];

  const pems = await selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'basicConstraints',
        cA: true,
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 2, value: 'api.local' },
          { type: 7, ip: '127.0.0.1' },
        ],
      },
    ],
  });

  fs.writeFileSync(path.join(sslDir, 'cert.pem'), pems.cert, 'utf8');
  fs.writeFileSync(path.join(sslDir, 'key.pem'), pems.private, 'utf8');

  console.log(`TLS certificates generated successfully in: ${sslDir}`);
  console.log(' - Certificate: cert.pem');
  console.log(' - Private Key: key.pem');
}

main().catch(console.error);
