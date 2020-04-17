// NOTE: this is re-implementation of some core methods of
// https://github.com/nodejs/node/blob/v12.x/lib/internal/modules/cjs/loader.js

import * as realFs from 'fs';
import * as Module from 'module';
import { isAbsolute, resolve, toNamespacedPath } from 'path';
import { isWindows, isWindowsPath, stripBOM, unixifyPath } from '../../common';

export function patchModuleLoader(staticFsRuntime) {
  const moduleExtensionsJS = Module._extensions['.js'];
  const moduleExtensionsJSON = Module._extensions['.json'];
  const moduleFindPath = Module._findPath;

  const statCache = {};
  const packageJsonCache = {};
  const sfs = staticFsRuntime.staticfilesystem;
  const pendingDeprecation = process.execArgv.includes('--pending-deprecation');

  // Returns the contents of the file as a string
  // or undefined when the file cannot be opened.
  // Not creating errors makes it run faster.
  function internalModuleReadFile(path) {
    try {
      return sfs.readFileSync(path, 'utf8');
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
      return sfs.statSync(filename).isDirectory() ? 1 : 0;
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

  function readPackageMain(requestPath) {
    const pkg = readPackage(requestPath);
    return pkg ? pkg.main : undefined;
  }

  function readPackage(requestPath) {
    const jsonPath = resolve(requestPath, 'package.json');

    const existing = packageJsonCache[jsonPath];
    if (existing !== undefined) return existing;

    const json = internalModuleReadFile(toNamespacedPath(jsonPath));
    if (json === undefined) {
      packageJsonCache[jsonPath] = false;
      return false;
    }

    try {
      const parsed = JSON.parse(json);
      const filtered = {
        name: parsed.name,
        main: parsed.main,
        exports: parsed.exports,
        type: parsed.type,
      };
      packageJsonCache[jsonPath] = filtered;
      return filtered;
    } catch (e) {
      e.path = jsonPath;
      e.message = 'Error parsing ' + jsonPath + ': ' + e.message;
      throw e;
    }
  }

  function tryFile(requestPath) {
    return stat(requestPath) === 0 ? sfs.realpathSync(requestPath) : undefined;
  }

  function tryExtensions(p, exts) {
    for (let i = 0; i < exts.length; i++) {
      const filename = tryFile(p + exts[i]);
      if (filename) {
        return filename;
      }
    }

    return undefined;
  }

  function tryPackage(requestPath, exts, originalPath) {
    const pkg = readPackageMain(requestPath);

    if (!pkg) {
      return tryExtensions(resolve(requestPath, 'index'), exts);
    }

    const filename = resolve(requestPath, pkg);
    let actual = tryFile(filename) || tryExtensions(filename, exts) || tryExtensions(resolve(filename, 'index'), exts);

    if (actual === undefined) {
      actual = tryExtensions(resolve(requestPath, 'index'), exts);
      if (!actual) {
        // eslint-disable-next-line no-restricted-syntax
        const err = new Error(
          `Cannot find module '${filename}'. ` + 'Please verify that the package.json has a valid "main" entry',
        );
        err.code = 'MODULE_NOT_FOUND';
        err.path = resolve(requestPath, 'package.json');
        err.requestPath = originalPath;
        throw err;
      } else if (pendingDeprecation) {
        const jsonPath = resolve(requestPath, 'package.json');
        process.emitWarning(
          `Invalid 'main' field in '${jsonPath}' of '${pkg}'. ` +
            'Please either fix that or report it to the module author',
          'DeprecationWarning',
          'DEP0128',
        );
      }
    }

    return actual;
  }

  Module._extensions['.js'] = (module, filename) => {
    const readFileFn = stat(filename) === 0 ? sfs.readFileSync.bind(sfs) : realFs.readFileSync.bind(this);
    module._compile(stripBOM(readFileFn(filename, 'utf8')), filename);
  };

  Module._extensions['.json'] = (module, filename) => {
    const readFileFn = stat(filename) === 0 ? sfs.readFileSync.bind(sfs) : realFs.readFileSync.bind(this);

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

    let result = Module._customFindPath(request, paths);

    // NOTE: special use case when we have a findPath call with a relative file request where
    // the given path is in the real fs and the relative file
    // is inside the static fs
    if (isRelative && paths.length === 1) {
      const resolvedRequest = resolve(paths[0], request);
      result = Module._customFindPath(resolvedRequest, paths);
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

  Module._customFindPath = (request, paths) => {
    const absoluteRequest = isAbsolute(request);
    if (absoluteRequest) {
      paths = [''];
    } else if (!paths || paths.length === 0) {
      return false;
    }

    const cacheKey = request + '\x00' + (paths.length === 1 ? paths[0] : paths.join('\x00'));
    const entry = Module._pathCache[cacheKey];
    if (entry) return entry;

    let exts;
    let trailingSlash = request.length > 0 && request.charCodeAt(request.length - 1) === 47;
    if (!trailingSlash) {
      trailingSlash = /(?:^|\/)\.?\.$/.test(request);
    }

    // For each path
    for (let i = 0; i < paths.length; i++) {
      // Don't search further if path doesn't exist
      const curPath = paths[i];
      if (curPath && stat(curPath) < 1) continue;
      // resolveExports is used in the node version
      // we are simplifying it here
      let basePath = resolve(curPath, request);
      let filename;

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

      if (!trailingSlash) {
        if (rc === 0) {
          // File.
          filename = sfs.realpathSync(basePath);
        }

        if (!filename) {
          // Try it with each of the extensions
          if (exts === undefined) exts = Object.keys(Module._extensions);
          filename = tryExtensions(basePath, exts);
        }
      }

      if (!filename && rc === 1) {
        // Directory.
        // try it with each of the extensions at "index"
        if (exts === undefined) exts = Object.keys(Module._extensions);
        filename = tryPackage(basePath, exts, request);
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
