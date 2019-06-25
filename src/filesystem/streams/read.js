import { Readable } from 'stream';
import util from 'util';

const ERR_STR_OPTS = typeOfOptions => `Expected options to be either an object or a string, but got ${typeOfOptions} instead`;

function assertEncoding(encoding) {
  if (encoding && !Buffer.isEncoding(encoding)) throw new Error(`ERR_INVALID_OPT_VALUE_ENCODING ${encoding}`);
}

function getOptions(options, defaultOptions) {
  if (options === null || options === undefined ||
    typeof options === 'function') {
    return defaultOptions;
  }

  if (typeof options === 'string') {
    defaultOptions = util._extend({}, defaultOptions);
    defaultOptions.encoding = options;
    options = defaultOptions;
  } else if (typeof options !== 'object') {
    throw new ERR_STR_OPTS(typeof options);
  }

  if (options.encoding !== 'buffer')
    assertEncoding(options.encoding);
  return options;
}

function copyObject(source) {
  const target = {};
  for (const key in source)
    target[key] = source[key];
  return target;
}

const kMinPoolSpace = 128;

let pool;
// It can happen that we expect to read a large chunk of data, and reserve
// a large chunk of the pool accordingly, but the read() call only filled
// a portion of it. If a concurrently executing read() then uses the same pool,
// the "reserved" portion cannot be used, so we allow it to be re-used as a
// new pool later.
const poolFragments = [];

function allocNewPool(poolSize) {
  if (poolFragments.length > 0)
    pool = poolFragments.pop();
  else
    pool = Buffer.allocUnsafe(poolSize);
  pool.used = 0;
}

export function ReadStream(sfs, path, options) {
  if (!(this instanceof ReadStream))
    return new ReadStream(sfs, path, options);

  this._sfs = sfs;

  // a little bit bigger buffer and water marks by default
  options = copyObject(getOptions(options, {}));
  if (options.highWaterMark === undefined)
    options.highWaterMark = 64 * 1024;

  // for backwards compat do not emit close on destroy.
  options.emitClose = false;

  Readable.call(this, options);

  this.path = path;
  this.fd = options.fd === undefined ? null : options.fd;
  this.flags = options.flags === undefined ? 'r' : options.flags;
  this.mode = options.mode === undefined ? 0o666 : options.mode;

  this.start = options.start;
  this.end = options.end;
  this.autoClose = options.autoClose === undefined ? true : options.autoClose;
  this.pos = undefined;
  this.bytesRead = 0;
  this.closed = false;

  if (this.start !== undefined) {
    if (typeof this.start !== 'number' || Number.isNaN(this.start)) {
      throw new TypeError('"start" option must be a Number');
    }
    if (this.end === undefined) {
      this.end = Infinity;
    } else if (typeof this.end !== 'number' || Number.isNaN(this.end)) {
      throw new TypeError('"end" option must be a Number');
    }

    if (this.start > this.end) {
      throw new Error('"start" option must be <= "end" option');
    }

    this.pos = this.start;
  }

  if (typeof this.end !== 'number')
    this.end = Infinity;
  else if (Number.isNaN(this.end))
    throw new TypeError('"end" option must be a Number');

  if (!this.fd || !this.fd.type || this.fd.type !== 'static_fs_file_descriptor')
    this.open();

  this.on('end', function() {
    if (this.autoClose) {
      this.destroy();
    }
  });
}
util.inherits(ReadStream, Readable);

ReadStream.prototype.open = function() {
  this._sfs.open(this.path, (er, fd) => {
    if (er) {
      if (this.autoClose) {
        this.destroy();
      }
      this.emit('error', er);
      return;
    }

    this.fd = fd;
    this.emit('open', fd);
    this.emit('ready');
    // start the flow of data.
    this.read();
  });
};

ReadStream.prototype._read = function(n) {
  if (!this.fd || !this.fd.type || this.fd.type !== 'static_fs_file_descriptor') {
    return this.once('open', function() {
      this._read(n);
    });
  }

  if (this.destroyed)
    return;

  if (!pool || pool.length - pool.used < kMinPoolSpace) {
    // discard the old pool.
    allocNewPool(this.readableHighWaterMark);
  }

  // Grab another reference to the pool in the case that while we're
  // in the thread pool another read() finishes up the pool, and
  // allocates a new one.
  const thisPool = pool;
  let toRead = Math.min(pool.length - pool.used, n);
  const start = pool.used;

  if (this.pos !== undefined)
    toRead = Math.min(this.end - this.pos + 1, toRead);
  else
    toRead = Math.min(this.end - this.bytesRead + 1, toRead);

  // already read everything we were supposed to read!
  // treat as EOF.
  if (toRead <= 0)
    return this.push(null);

  // the actual read.
  this._sfs.read(this.fd, pool, pool.used, toRead, this.pos, (er, bytesRead) => {
    if (er) {
      if (this.autoClose) {
        this.destroy();
      }
      this.emit('error', er);
    } else {
      let b = null;
      // Now that we know how much data we have actually read, re-wind the
      // 'used' field if we can, and otherwise allow the remainder of our
      // reservation to be used as a new pool later.
      if (start + toRead === thisPool.used && thisPool === pool)
        thisPool.used += bytesRead - toRead;
      else if (toRead - bytesRead > kMinPoolSpace)
        poolFragments.push(thisPool.slice(start + bytesRead, start + toRead));

      if (bytesRead > 0) {
        this.bytesRead += bytesRead;
        b = thisPool.slice(start, start + bytesRead);
      }

      this.push(b);
    }
  });

  // move the pool positions, and internal position for reading.
  if (this.pos !== undefined)
    this.pos += toRead;
  pool.used += toRead;
};

ReadStream.prototype._destroy = function(err, cb) {
  if (!this.fd || !this.fd.type || this.fd.type !== 'static_fs_file_descriptor') {
    this.once('open', closeFsStream.bind(null, this, cb, err));
    return;
  }

  closeFsStream(this, cb, err);
  this.fd = null;
};

function closeFsStream(stream, cb, err) {
  stream._sfs.close(stream.fd, (er) => {
    er = er || err;
    cb(er);
    stream.closed = true;
    if (!er)
      stream.emit('close');
  });
}

ReadStream.prototype.close = function(cb) {
  this.destroy(null, cb);
};

Object.defineProperty(ReadStream.prototype, 'pending', {
  get() { return this.fd === null; },
  configurable: true
});
