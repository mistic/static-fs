// NOTE: this is re-implementation of some core methods of
// https://github.com/nodejs/node/blob/v10.x/lib/internal/modules/cjs/loader.js

import * as patchedFs from 'fs';
import * as Module from 'module';
import { isAbsolute, resolve, toNamespacedPath } from 'path';
import { isWindows, isWindowsPath, stripBOM, unixifyPath } from '../../common';

export function patchModuleLoader() {
  const moduleExtensionsJS = Module._extensions['.js'];
  const moduleExtensionsJSON = Module._extensions['.json'];
  const moduleFindPath = Module._findPath;

  const statCache = {};
  const packageMainCache = {};

  // Returns the contents of the file as a string
  // or undefined when the file cannot be opened.
  // Not creating errors makes it run faster.
  function internalModuleReadFile(path) {
    try {
      return patchedFs.readFileSync(path, 'utf8');
    } catch {
      /* no-op */
    }

    return undefined;
  }

  // Returns 0 if the path refers to a file,
  // 1 when it's a directory
  // or < 0 on error (usually -ENOENT).
  // Not creating errors makes it run faster.
  function internalModuleStat(filename) {
    try {
      return patchedFs.statSync(filename).isDirectory() ? 1 : 0;
    } catch {
      /* no-op */
    }

    // ENOENT
    return -2;
  }

  function stat(filename) {
    filename = toNamespacedPath(filename);
    const result = statCache[filename];

    return result !== undefined ? result : (statCache[filename] = internalModuleStat(filename));
  }

  function readPackage(requestPath) {
    const entry = packageMainCache[requestPath];
    if (entry) {
      return entry;
    }

    const jsonPath = resolve(requestPath, 'package.json');
    const json = internalModuleReadFile(toNamespacedPath(jsonPath));

    if (json === undefined) {
      return false;
    }

    let pkg;
    try {
      pkg = packageMainCache[requestPath] = JSON.parse(json).main;
    } catch (e) {
      e.path = jsonPath;
      e.message = 'Error parsing ' + jsonPath + ': ' + e.message;
      throw e;
    }

    return pkg;
  }

  function tryFile(requestPath, isMain) {
    if (!isMain) {
      return stat(requestPath) === 0 ? resolve(requestPath) : undefined;
    }

    return stat(requestPath) === 0 ? patchedFs.realpathSync(requestPath) : undefined;
  }

  function tryExtensions(p, exts, isMain) {
    for (let i = 0; i < exts.length; i++) {
      const filename = tryFile(p + exts[i], isMain);
      if (filename) {
        return filename;
      }
    }

    return undefined;
  }

  function tryPackage(requestPath, exts, isMain) {
    let pkg = readPackage(requestPath);

    if (pkg) {
      let filename = resolve(requestPath, pkg);
      return (
        tryFile(filename, isMain) ||
        tryExtensions(filename, exts, isMain) ||
        tryExtensions(resolve(filename, 'index'), exts, isMain)
      );
    }

    return undefined;
  }

  Module._extensions['.js'] = (module, filename) => {
    const readFileFn = patchedFs.readFileSync.bind(this);
    module._compile(stripBOM(readFileFn(filename, 'utf8')), filename);
  };

  Module._extensions['.json'] = (module, filename) => {
    const readFileFn = patchedFs.readFileSync.bind(this);

    try {
      module.exports = JSON.parse(stripBOM(readFileFn(filename, 'utf8')));
    } catch (err) {
      throw { ...err, message: filename + ': ' + err.message };
    }
  };

  Module._findPath = (request, paths, isMain) => {
    const isRelative =
      request.startsWith('./') ||
      request.startsWith('../') ||
      (isWindows && request.startsWith('.\\')) ||
      request.startsWith('..\\');

    let result = Module._customFindPath(request, paths, isMain);

    if (result) {
      return result;
    }

    // NOTE: special use case when we have a findPath call with a relative file request where
    // the given path is in the real fs and the relative file
    // is inside the static fs
    if (isRelative && paths.length === 1) {
      const resolvedRequest = resolve(paths[0], request);
      result = Module._customFindPath(resolvedRequest, paths, isMain);
    }

    if (result) {
      return result;
    }

    // NOTE: special use case when we have a findPath call with a relative file request where
    // the given path is inside the static fs and the relative file
    // request in the real fs (for example in the native modules).
    //
    // moduleFindPath -> is the original Module._findPath
    if (isRelative && paths.length === 1) {
      const resolvedRequest = resolve(paths[0], request);
      result = moduleFindPath(resolvedRequest, paths, isMain);
    }

    return !result ? moduleFindPath(request, paths, isMain) : result;
  };

  Module._customFindPath = (request, paths, isMain) => {
    if (!request) {
      return false;
    }
    if (isAbsolute(request)) {
      paths = [''];
    } else if (!paths || paths.length === 0) {
      return false;
    }

    const cacheKey = request + '\x00' + (paths.length === 1 ? paths[0] : paths.join('\x00'));
    const entry = Module._pathCache[cacheKey];
    if (entry) {
      return entry;
    }

    const trailingSlash = request.charCodeAt(request.length - 1) === 47;

    // For each path
    for (const curPath of paths) {
      if (curPath && stat(curPath) < 1) {
        continue;
      }

      let basePath = resolve(curPath, request);
      let rc = stat(basePath);

      // check if this is a windows paths and if it should be corrected
      if (rc < 0 && isWindowsPath(basePath)) {
        // uncorrected path doesn't work, maybe the correctedPath?
        let correctedPath = unixifyPath(basePath);
        rc = stat(correctedPath);
        if (rc >= 0) {
          // use it
          basePath = correctedPath;
        }
      }

      let filename;
      const exts = Object.keys(Module._extensions);
      if (!trailingSlash) {
        switch (rc) {
          case 0:
            filename = !isMain ? resolve(basePath) : patchedFs.realpathSync(basePath);
            break;
          case 1:
            filename = tryPackage(basePath, exts, isMain);
            break;
        }

        if (!filename) {
          // try it with each of the extensions
          filename = tryExtensions(basePath, exts, isMain);
        }
      }

      if (!filename && rc === 1) {
        // Directory.
        filename = tryPackage(basePath, exts, isMain) || tryExtensions(resolve(basePath, 'index'), exts, isMain);
      }

      if (filename) {
        Module._pathCache[cacheKey] = filename;
        return filename;
      }
    }
    return false;
  };

  return () => {
    Module._extensions['.js'] = moduleExtensionsJS;
    Module._extensions['.json'] = moduleExtensionsJSON;
    Module._findPath = moduleFindPath;
    Module._cache = {};
    Module._pathCache = {};
  };
}
