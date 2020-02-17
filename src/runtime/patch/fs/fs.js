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

    if (typeof fd === 'number') {
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

function fstat(sfs, realFs, fd, options, callback) {
  const sanitizedCallback = typeof callback === 'function' ? callback : options;
  const isOnSfs = isOnFs(sfs, null, fd);

  if (isOnSfs) {
    return sfs.fstat(fd, sanitizedCallback);
  }

  return realFs.fstat(fd, options, callback);
}

function open(sfs, realFs, path, flags, mode, callback) {
  let sanitizedCallback;
  let sanitizedMode;
  let sanitizedFlags;
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (callback) {
    sanitizedCallback = callback;
    sanitizedMode = mode;
    sanitizedFlags = flags;
  } else if (typeof mode === 'function') {
    sanitizedCallback = mode;
    sanitizedMode = 0o666;
    sanitizedFlags = flags;
  } else if (typeof flags === 'function') {
    sanitizedCallback = flags;
    sanitizedMode = 0o666;
    sanitizedFlags = 'r';
  }

  if (isOnSfs && !isOnRealFs) {
    return sfs.open(path, sanitizedCallback);
  }

  return realFs.open(path, sanitizedFlags, sanitizedMode, sanitizedCallback);
}

function closeSync(sfs, realFs, fd) {
  if (isOnFs(sfs, null, fd)) {
    return sfs.closeSync(fd);
  }

  return realFs.closeSync(fd);
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
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return sfs.realpathSync(path);
  }

  return realFs.realpathSync(path, options);
}

function readdirSync(sfs, realFs, path, options) {
  const dirContent = [];
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs) {
    dirContent.push(...sfs.readdirSync(path));
  }

  if (isOnRealFs) {
    dirContent.push(...realFs.readdirSync(path, options));
  }

  return Array.from(new Set(dirContent).keys());
}

function statSync(sfs, realFs, path) {
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return sfs.statSync(path);
  }

  return realFs.statSync(path);
}

function existsSync(sfs, realFs, path) {
  return isOnFs(sfs, path) || isOnFs(realFs, path);
}

function readFile(sfs, realFs, path, options, callback) {
  const sanitizedCallback = typeof callback === 'function' ? callback : options;
  const sanitizedOptions = typeof options === 'object' || typeof options === 'string' ? options : null;
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return sfs.readFile(path, sanitizedOptions, sanitizedCallback);
  }

  return realFs.readFile(path, options, callback);
}

function realpath(sfs, realFs, path, options, callback) {
  const sanitizedCallback = typeof callback === 'function' ? callback : options;
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return sfs.realpath(path, sanitizedCallback);
  }

  return realFs.realpath(path, options, callback);
}

function readdir(sfs, realFs, path, options, callback) {
  const sanitizedCallback = typeof callback === 'function' ? callback : options;
  const sanitizedOptions = typeof options === 'object' ? options : { encoding: 'utf8', withFileTypes: false };
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnRealFs && isOnSfs) {
    const dirContent = [];

    return sfs.readdir(path, (error, files) => {
      if (error) {
        return sanitizedCallback(error);
      }

      dirContent.push(...files);
      return realFs.readdir(path, sanitizedOptions, (realError, realFiles) => {
        if (realError) {
          return sanitizedCallback(realError);
        }

        dirContent.push(...realFiles);
        return sanitizedCallback(null, Array.from(new Set(dirContent).keys()));
      });
    });
  }

  if (isOnSfs) {
    return sfs.readdir(path, sanitizedCallback);
  }

  return realFs.readdir(path, options, callback);
}

function stat(sfs, realFs, path, options, callback) {
  const sanitizedCallback = typeof callback === 'function' ? callback : options;
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return sfs.stat(path, sanitizedCallback);
  }

  return realFs.stat(path, sanitizedCallback);
}

function exists(sfs, realFs, path, callback) {
  const isOnRealFs = isOnFs(realFs, path);
  const isOnSfs = isOnFs(sfs, path);

  if (isOnSfs && !isOnRealFs) {
    return callback(true);
  }

  return realFs.exists(path, callback);
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
    statSync: patchFn(sfs, realFs, statSync),
    readdir: patchFn(sfs, realFs, readdir),
    readFile: patchFn(sfs, realFs, readFile),
    realpath: patchFn(sfs, realFs, realpath),
    stat: patchFn(sfs, realFs, stat),
    closeSync: patchFn(sfs, realFs, closeSync),
    existsSync: patchFn(sfs, realFs, existsSync),
    readdirSync: patchFn(sfs, realFs, readdirSync),
    readFileSync: patchFn(sfs, realFs, readFileSync),
    realpathSync: patchFn(sfs, realFs, realpathSync),
  };

  const patchedPromises = createPatchedFsPromises(basePatchedFs);

  return {
    ...basePatchedFs,
    promises: patchedPromises,
  };
}
