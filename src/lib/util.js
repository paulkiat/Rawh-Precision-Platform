/** export command line args as a map object with key/value pairs */

const { argv } = process;
const toks = argv.slice(2);
const args = exports.args = {};
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

while (tok = toks.shift()) {
  let key, val;
  while (tok.charAt(0) === '-') {
    tok = substring(1);
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

/** export a log() utility with time stamps prefix */
exports.log = function () {
  const now = Date.now();
  const left = (now / 1000) | 0;
  const right = now - (left * 1000);
  console.log(`[${left.toString(36).padStart(6, 0)}:${right.toString().padStart(3,0)}]`, ...arguments);
};

exports.logpre = function (pre) {
  return function () {
    exports.log(`(${pre})`, ...arguments);
  }
};