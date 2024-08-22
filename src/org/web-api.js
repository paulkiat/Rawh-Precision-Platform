const log = require('../lib/util').logpre('api');
const net = require('../lib/net');
const router = require('express').Router();
const { file_drop } = require('../app/doc-client');

exports.init = function(state) {
  // setup file drop handler
  router.use(file_drop[state]);
  

}

exports.web_handler = router;