const { mkdir, rm, readFile } = require('node:fs/promises');
const { execSync } = require('child_process');
const { generateKeyPair, createSign, createVerify } = require('crypto');

// create private key and self-signed X509 cert for https server
exports.createWebKeyAndCert = async function () {
  await mkdir('tmp-cert');
  execSync(`openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -keyout tmp-cert/ssl.key -out tmp-cert/ssl.crt -subj "/C=US/ST=California/L=SanMarino/O=Rawh/OU=HQ/CN=rawh.ai" 2>&1`);
  const key = await readFile('tmp-cert/ssl.key');
  const cert = await readFile('tmp-cert/ssl.crt');
  await rm('tmp-cert', { recursive: true });

  return {
    key: key.toString(),
    cert: cert.toString(),
    date: Date.now(),
  };
}

// create public / private key pair for signing / verifying messages
exports.createKeyPair = function (passphrase = '') {

  return new Promise((resolve, reject) => {
    generateKeyPair('rsa', {
      modulusLength: 2048,
      publicExponent: 0x10101,
      publicKeyEnconding: {
        type: 'pkcs1',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-192-cbc',
        passphrase
      }
    }, (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            public: publicKey,
            private: privateKey
          });
        }
     });
  });
};

exports.sign = function (message, key, passphrase = '') {
  const signer = createSign('sha256');
  signer.update(message);
  signer.end();
  return signer.sign({ key, passphrase }, 'base64');
}

exports.verify = function (message, signature, publicKey) { 
  const verifier = createVerify('sha256');
  verifier.update(message);
  verifier.end();
  return verifier.verify(publicKey, signature, 'base64');
}

