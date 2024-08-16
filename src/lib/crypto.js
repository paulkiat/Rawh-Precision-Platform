// Including generate key pair from crypto module
const { generateKeyPair } = require('crypto');

exports.generateKeyPair = function (passphrase = 'rawh') {
  return new Promise(( resolve, reject ) => {
    generateKeyPair('rsa', {
      modulusLength: 2048, // options
      publicExponent: 0x10101,
      publicKeyEnconding: {
        type: 'pkcs1',
        format: 'der'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der',
        encoding: 'aes-192-cbc',
        passphrase
      }
    }, ( err, publicKey, privateKey ) => { // callback function
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