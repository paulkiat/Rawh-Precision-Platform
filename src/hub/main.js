/**
 * main hub for rawh that services customer/orgs
 * acts as the master for all org meta-data
 * collects log and usage data from orgs
 */

const { args } = require('../lib/util');
const { log } = require('../lib/util').logpre('hub');
const crypto = require('../lib/crypto');
const store = require('../lib/store');
const https = require('node:https');

/**
 * INITIALIZATION
 * 
 * 1. open meta-data data-store
 * 2. open log-data data-store
 * 3. detect first-time setup, create pub/priv key pair
 * 4. start https listening endpoints
 */

async function init_data_store() {
  log('initialized data store');
  await store.open("hub-meta-data");
}

async function init_log_store() {
  log('initialized log store');
  await store.open("hub-log-store");
}

async function detect_first_time_setup() {
  log('detect first-time setup');
  const keys = await crypto.createKeyPair();
  log({ keys });
}

async function start_http_listener() {
  https && log('starts http listener')
}