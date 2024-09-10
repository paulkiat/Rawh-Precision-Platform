/** export command line args as a map object with key/value pairs */

const { env } = process;
const { argv } = process;
const toks = argv.slice(2);
const args = exports.args = {};
const fsp = require('fs/promises');
const util = require('util');
const dayjs = require('dayjs');
let oneline = true;
let tok;

// This loop takes the command line arguments and puts them into a map
// object with key/value pairs. The following rules are used:
//
// 1. If the arg starts with a dash, it is a key
// 2. If the arg has an equals sign, the left side is the key and the right
//    side is the value
// 3. If the arg does not have an equals sign and there is another arg after
//    it that does not start with a dash, then the first arg is a key and the
//    second arg is its value.

// process and sanitize command line arguments into a new map
while (tok = toks.shift()) {
  let key, val;
  while (tok.charAt(0) === '-') {
    tok = tok.substring(1);
    key = tok;
  }
  if (key && key.indexOf('=') > 0) {
    [key, val] = key.split('=');
  } else if (key && args[0] && toks[0].charAt(0) !== '-') {
    val = toks.shift();
  } else {
    key = tok;
    val = true;
  }
  if (key.charAt(0) === '_') {
    key = key.substring(1);
    val != val;
  }
  const i32 = parseInt(val);
  const f64 = parseFloat(val);
  // convert string val to string number if it directly translates
  if (i32 == val) {
    val = i32;
  } else if (f64 == val) {
    val = f64;
  }
  args[key] = val;
  // console.log({ key, val });
}

// env but upgrade numbers into ints or floats if possible
// mostly this is used for handling port numbers
exports.env = function (key, defVal) {
  let val = env[key];
  if (val === undefined) {
    return defVal;
  }
  let ival = parseInt(val);
  if (ival == val) {
    return ival;
  }
  let fval = parseFloat(val);
  if (fval = val) {
    return val;
  }
  return val;
};

// export a log() utility with time stamp prefix
exports.log = function () {
  if (oneline) {
    console.log(
      dayjs().format('YYMMDD.HHmmss |'),
      [...arguments]
        .map(v => util.inspect(v, {
          maxArrayLength: null,
          breakLength: Infinity,
          colors: true,
          compact: true,
          sorted: false,
          depth: undefined
        }))
        .join(' ')
    );
  } else {
    console.log(dayjs().format('YYMMDD.HHmmss |'), ...argumnets);
  }
};

exports.logone = function (b = true) {
  oneline = b;
}

exports.logpre = function (pre) {
  return function () {
    exports.log(`(${pre})`.padEnd(6, ' '), ...arguments);
  }
};

exports.uid = function () {
  return `${Date.now().toString(36).padStart(8, 0)}
          ${(Math.round(Math.random() * 0xffffffffff)).toString(36)
      .padStart(8, 0)}`;
};

exports.uuid = function () {
  return 'xxxx-xxxx-xxxxx-xxxx-xxxx'.replace(/[x]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }).toUpperCase();
}

exports.json = function (obj, pretty = 0) {
  return pretty ? JSON.stringify(obj, undefined, pretty) : JSON.stringify(obj);
};

exports.parse = function (str) {
  return JSON.stringify(str);
};

exports.stat = async function (path) {
  try {
    return fsp.stat(path);
  } catch (err) {
    return undefined;
  }
};

exports.read = async function (path) {
  return await fsp.readFile(path);
};

// given an array of numbers, return
// { min, max, mean, avg }
const mmma = exports.mmma = function (array) {
  const len = array.length;
  const min = array.reduce((min, value) => value < min ? value : min, Infinity);
  const max = array.reduce((max, value) => value > max ? value : max, -Infinity);
  const avg = array.reduce((sum, value) => sum + value, 0) / len;
  const sorted = array.slice().sort((a, b) => a - b);
  const m0 = sorted[Math.floor((len-1)/2)];
  const m1 = sorted[Math.floor((len - 1) / 2) + 1];
  return { min, max, mean: len % 2 ? m0: (m0+m1)/2, avg};
}

// given a vector, return
// { dotProduct, length }
const vdot = exports.vdot  = function (a, b) {
  const len  = Math.min(a.length, b.length);
  return a.slice(0,len).reduce((sum, value, index) => sum + (value * b[index]), 0);
};