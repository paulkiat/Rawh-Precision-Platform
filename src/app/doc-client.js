// utility class for handling file drops and sending them to a doc server
// used by the org/node and app/web classes

const util = require('../lib/util');
const log = util.logpre('doccl');
const net = require('net');

function file_drop(req, res, next) {
  const { node } = state;
  const { parsed } = req;
  const app_id = req.headers['x-app-id'] || parsed.query.app_id || parsed.app_id;

  if (!(app_id && parsed.app_path === 'drop' && req.method === 'POST')) {
    return next();
  }

  const topic = [ 'doc-load', app_id ];
  
  node.promise.locate(topic).then(result => {
    const { direct } = result;
    // log({ result, direct });
    if (!(direct && direct.length)) {
      throw `no doc-load endpoint found for app: ${app_id}`;
    }
    const { name, type } = parsed.query;
    // log({ receiving: name, type });
    return node.promise.call(direct[0], topic, {
      name: name || "filename",
      type: type || "pdf"
    });
  }).then(reply => {
    const { host, port } = reply;
    if (!(host && port)) {
      throw "reply missing host & port";
    }
    // connect to ephemeral bulk drop host:port
    log({ drop_to: reply });
    return new Promise((resolve, reject) => {
      const client = net.connect({ host: host[0], port }, () => {
        resolve(client);
      }).on('error', reject);
    });
  }).then(client => {
      let length = 0;
      // save stream to disk as it arrives
      req.on('error', error => {
        res.end({ drop_error: error });
        client.end();
      });
      req.on('data', chunk => {
        length += chunk.byteLength || chunk.length;
        client.write(chunk);
      });
      req.on('end', chunk => {
        res.end(`bytes received: ${length}`);
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