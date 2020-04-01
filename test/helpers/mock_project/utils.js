'use strict';

const { resolve } = require('path');
const { unixifyPath } = require('static-fs/dist/common');

module.exports.sanitizePath = function(...args) {
  return unixifyPath(resolve(...args));
};
