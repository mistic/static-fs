import { createPatchedFsPromises } from './promises';

function patchFn(sfs, realFs, fn) {
  return (...args) => {
    return fn(sfs, realFs, ...args);
  };
}

function existsInFs(fs, filePath) {
  try {
    if (!filePath) {
      return false;
    }

    return !!fs.statSync(filePath);
  } catch {
    /* no-op */
  }
  return false;
}

function existsFdInFs(fs, fd) {
  try {
    if (!fd) {
      return false;
    }

    // check for uint32
    if (typeof fd === 'number' && fd >>> 0 === fd) {
      return !!fs.fstatSync(fd);
    }

    if (!fs.getValidatedFD) {
      return false;
    }

    fs.getValidatedFD(fd);
    return existsInFs(fs, fd.filePath);
  } catch {
    /* no-op */
  }
  return false;
}

function isOnFs(fs, path, fd = null) {
  return existsInFs(fs, path) || existsFdInFs(fs, fd);
}

// Node Fs module patched methods
function close(sfs, realFs, fd, callback) {
  if (isOnFs(sfs, null, fd)) {
    return sfs.close(fd, callback);
  }

  return realFs.close(fd, callback);
}

function createReadStream(sfs, realFs, path, options) {
  const optionsFd = options && options.fd;
  const isOnRealFs = isOnFs(realFs, path, optionsFd);
  const isOnSfs = isOnFs(sfs, path, optionsFd);

  if (isOnSfs && !isOnRealFs) {
    return sfs.createReadStream(path, options);
  }

  return realFs.createReadStream(path, options);
}

function exists(sfs, realFs, path, callback) {
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs || isOnRealFs) {
    return callback(true);
  }

  return callback(false);
}

function fstat(sfs, realFs, fd, options, callback) {
  const sanitizedOptions = typeof options === 'function' ? { bigint: false } : options;
  const sanitizedCallback = typeof callback === 'function' ? callback : options;
  const isOnSfs = isOnFs(sfs, null, fd);

  if (isOnSfs) {
    return sfs.fstat(fd, sanitizedOptions, sanitizedCallback);
  }

  return realFs.fstat(fd, sanitizedOptions, sanitizedCallback);
}

function open(sfs, realFs, path, flags, mode, callback) {
  let sanitizedCallback;
  let sanitizedMode;
  let sanitizedFlags;
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (typeof mode === 'function') {
    sanitizedCallback = mode;
    sanitizedMode = 0o666;
    sanitizedFlags = flags;
  } else if (typeof flags === 'function') {
    sanitizedCallback = flags;
    sanitizedMode = 0o666;
    sanitizedFlags = 'r';
  } else {
    sanitizedCallback = callback;
    sanitizedMode = mode;
    sanitizedFlags = flags;
  }

  if (isOnSfs && !isOnRealFs) {
    return sfs.open(path, sanitizedFlags, sanitizedCallback);
  }

  return realFs.open(path, sanitizedFlags, sanitizedMode, sanitizedCallback);
}

function read(sfs, realFs, fd, buffer, offset, length, position, callback) {
  const isOnRealFs = isOnFs(realFs, null, fd);
  const isOnSfs = isOnFs(sfs, null, fd);

  if (isOnSfs && !isOnRealFs) {
    return sfs.read(fd, buffer, offset, length, position, callback);
  }

  return realFs.read(fd, buffer, offset, length, position, callback);
}

function readdir(sfs, realFs, path, options, callback) {
  const sanitizedCallback = typeof callback === 'function' ? callback : options;
  const sanitizedOptions = typeof options === 'object' ? options : { encoding: 'utf8', withFileTypes: false };
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnRealFs && isOnSfs) {
    const sfsReadDir = new Promise((resolve, reject) => {
      sfs.readdir(path, sanitizedOptions, (error, files) => {
        if (error) {
          return reject(error);
        }

        resolve(files);
      });
    });

    const realFsReadDir = new Promise((resolve, reject) => {
      realFs.readdir(path, sanitizedOptions, (realError, realFiles) => {
        if (realError) {
          return reject(realError);
        }

        resolve(realFiles);
      });
    });

    return Promise.all([sfsReadDir, realFsReadDir])
      .then((allFiles) => {
        sanitizedCallback(null, Array.from(new Set([].concat(...allFiles)).keys()));
      })
      .catch((error) => {
        sanitizedCallback(error);
      });
  }

  if (isOnSfs) {
    return sfs.readdir(path, sanitizedOptions, sanitizedCallback);
  }

  return realFs.readdir(path, sanitizedOptions, sanitizedCallback);
}

function readFile(sfs, realFs, path, options, callback) {
  const sanitizedCallback = typeof callback === 'function' ? callback : options;
  const sanitizedOptions = typeof options === 'object' || typeof options === 'string' ? options : null;
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return sfs.readFile(path, sanitizedOptions, sanitizedCallback);
  }

  return realFs.readFile(path, sanitizedOptions, sanitizedCallback);
}

function realpath(sfs, realFs, path, options, callback) {
  const sanitizedCallback = typeof callback === 'function' ? callback : options;
  const sanitizedOptions = typeof options === 'object' ? options : { encoding: 'utf8' };
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return sfs.realpath(path, sanitizedOptions, sanitizedCallback);
  }

  return realFs.realpath(path, sanitizedOptions, sanitizedCallback);
}

function stat(sfs, realFs, path, options, callback) {
  const sanitizedOptions = typeof options === 'function' ? { bigint: false } : options;
  const sanitizedCallback = typeof callback === 'function' ? callback : options;
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return sfs.stat(path, sanitizedOptions, sanitizedCallback);
  }

  return realFs.stat(path, sanitizedOptions, sanitizedCallback);
}

function openSync(sfs, realFs, path, flags, mode) {
  let sanitizedMode;
  let sanitizedFlags;
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (!mode) {
    sanitizedMode = 0o666;
    sanitizedFlags = flags;
  } else if (!flags) {
    sanitizedMode = 0o666;
    sanitizedFlags = 'r';
  } else {
    sanitizedMode = mode;
    sanitizedFlags = flags;
  }

  if (isOnSfs && !isOnRealFs) {
    return sfs.openSync(path, sanitizedFlags);
  }

  return realFs.openSync(path, sanitizedFlags, sanitizedMode);
}

function closeSync(sfs, realFs, fd) {
  if (isOnFs(sfs, null, fd)) {
    return sfs.closeSync(fd);
  }

  return realFs.closeSync(fd);
}

function existsSync(sfs, realFs, path) {
  return isOnFs(sfs, path) || isOnFs(realFs, path);
}

function fstatSync(sfs, realFs, fd, options) {
  const sanitizedOptions = options || { bigint: false };
  const isOnSfs = isOnFs(sfs, null, fd);

  if (isOnSfs) {
    return sfs.fstatSync(fd, sanitizedOptions);
  }

  return realFs.fstatSync(fd, sanitizedOptions);
}

function readSync(sfs, realFs, fd, buffer, offset, length, position) {
  const isOnRealFs = isOnFs(realFs, null, fd);
  const isOnSfs = isOnFs(sfs, null, fd);

  if (isOnSfs && !isOnRealFs) {
    return sfs.readSync(fd, buffer, offset, length, position);
  }

  return realFs.readSync(fd, buffer, offset, length, position);
}

function readdirSync(sfs, realFs, path, options) {
  const sanitizedOptions = typeof options === 'object' ? options : { encoding: 'utf8', withFileTypes: false };
  const dirContent = [];
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs) {
    dirContent.push(...sfs.readdirSync(path, sanitizedOptions));
  }

  if (isOnRealFs) {
    dirContent.push(...realFs.readdirSync(path, sanitizedOptions));
  }

  return Array.from(new Set(dirContent).keys());
}

function readFileSync(sfs, realFs, path, options) {
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return sfs.readFileSync(path, options);
  }

  return realFs.readFileSync(path, options);
}

function realpathSync(sfs, realFs, path, options) {
  const sanitizedOptions = typeof options === 'object' ? options : { encoding: 'utf8' };
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return sfs.realpathSync(path, sanitizedOptions);
  }

  return realFs.realpathSync(path, sanitizedOptions);
}

function statSync(sfs, realFs, path, options) {
  const sanitizedOptions = options || { bigint: false };
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return sfs.statSync(path, sanitizedOptions);
  }

  return realFs.statSync(path, sanitizedOptions);
}

export function createPatchedFs(sfsRuntime, originalFs) {
  const sfs = sfsRuntime.staticfilesystem;
  const realFs = { ...originalFs };

  const basePatchedFs = {
    close: patchFn(sfs, realFs, close),
    createReadStream: patchFn(sfs, realFs, createReadStream),
    exists: patchFn(sfs, realFs, exists),
    fstat: patchFn(sfs, realFs, fstat),
    open: patchFn(sfs, realFs, open),
    read: patchFn(sfs, realFs, read),
    readdir: patchFn(sfs, realFs, readdir),
    readFile: patchFn(sfs, realFs, readFile),
    realpath: patchFn(sfs, realFs, realpath),
    stat: patchFn(sfs, realFs, stat),
    closeSync: patchFn(sfs, realFs, closeSync),
    existsSync: patchFn(sfs, realFs, existsSync),
    fstatSync: patchFn(sfs, realFs, fstatSync),
    openSync: patchFn(sfs, realFs, openSync),
    readSync: patchFn(sfs, realFs, readSync),
    readdirSync: patchFn(sfs, realFs, readdirSync),
    readFileSync: patchFn(sfs, realFs, readFileSync),
    realpathSync: patchFn(sfs, realFs, realpathSync),
    statSync: patchFn(sfs, realFs, statSync),
  };

  const patchedPromises = createPatchedFsPromises(basePatchedFs);

  return {
    ...basePatchedFs,
    promises: patchedPromises,
  };
}
