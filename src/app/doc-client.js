// utility class for handling file drops and sending them to a doc server
// used by the org/node and app/web classes

const log = require('../lib/util').logpre('doc-client');
const net = require('net');

function file_drop(req, res, next) {
  const { node } = state;
  const { parsed } = req;
  const { app_id } = parsed.query;

  // log({ parsed, app_id, method: req.method });

  if (!(parsed.url.pathname === '/drop' && req.method === 'POST')) {
    return next();
  }

  const topic = [ 'doc-load', app_id ];
  
  // log({ locate: topic });
  node.promise.locate(topic).then(result => {
    const { direct } = result;
    // log({ result, direct });
    if (!(direct && direct.length)) {
      throw `no doc-load endpoint found for app: ${app_id}`;
    }
    // log({ call: direct[0], topic });
    return node.promise.call(direct[0], topic, {
      name: "filename",
      type: "pdf"
    });
  }).then(reply => {
    const { host, port } = reply;
    if (!(host && port)) {
      throw "reply missing host & port";
    }
    // connect to ephemeral bulk drop host:port
    // log({ drop_to: reply });
    return new Promise((resolve, reject) => {
      const client = net.connect({ host: host[0], port }, () => {
        resolve(client);
      }).on('error', reject);
    });
  }).then(client => {
    req.on('error', error => {
      res.end({ drop_error: error });
      client.end();
    });
    req.on('data', chunk => {
      // log({ chunk });
      client.write(chunk);
    });
    req.on('end', chunk => {
      res.end('dropped!');
      client.end();
    });
  }).catch(error => {
    log({ file_drop_error: error });
    next();
  });
}
exports.file_drop = (state) => {
  return (req, res, next) => {
    file_drop(req, res, next, state);
  }
};