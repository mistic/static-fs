import * as fs from 'fs'
import * as child_process from 'child_process';
import { patchModuleLoader } from './patch/module_loader';
import { StaticFilesystem } from '../filesystem';
import { patchFilesystem } from './patch/filesystem';
import { select } from '../common';
const Module = require('module');

if (isRunningAsEntry()) {
  // this is for "fork mode" where we are forking a child process.
  // the first parameter should be this file.
  // the following parameter should be the static module file.
  const currentRuntimePath = process.env.STATIC_FS_MAIN_RUNTIME_PATH || module.filename;
  let startPath = null;

  try {
    startPath = fs.realpathSync(currentRuntimePath);
  } catch {}

  if (!startPath) {
    console.log('Cannot resolve the current static fs runtime file path');
    process.exit(1);
  }

  for (let i = 0; i < process.argv.length; i++) {
    if (fs.realpathSync(process.argv[i]) === startPath) {
      process.argv.splice(i, 1);
      while (i < process.argv.length && process.argv[i].startsWith('load-static-fs-volume=')) {
        const staticModule = process.argv[i].split('=')[1];
        process.argv.splice(i, 1);
        load(staticModule);
      }
      if (process.argv.length < 2) {
        console.log('Missing the module name to start.');
        process.exit(1);
      }
      // load the main module as if it were the real deal
      Module._load(process.argv[1], null, true);
      // Handle any nextTicks added in the first tick of the program
      process._tickCallback();
      break;
    }
  }
}

const possibilities = [
  'node',
  'node.exe',
  process.execPath,
  process.argv[0]
];

function isRunningAsEntry() {
  return require.main === module || process && process.env && process.env.STATIC_FS_ENV;
}

function isNode(path) {
  return possibilities.indexOf(path) > -1;
}

function indexAfterStartsWith(command, text) {
  return command.startsWith(text) ? text.length : -1;
}

function startsWithNode(command) {
  if (command.charAt(0) === '"') {
    // check includes quotes
    for (const each of possibilities) {
      const val = indexAfterStartsWith(command, `"${each}" `);
      if (val > -1) {
        return val
      }
    }
  } else {
    for (const each of possibilities) {
      const val = indexAfterStartsWith(command, `${each} `);
      if (val > -1) {
        return val
      }
    }
  }
  return -1;
}

function getInsertedArgs(loadedVolumes) {
  return select(loadedVolumes, (p, c) => `--load-static-fs-volume=${c}`);
}

function getInsertedArgString(loadedVolumes) {
  return `${getInsertedArgs(loadedVolumes).map((a) => `\"${a}\"`).join(' ')}`;
}

function padStart(str, targetLength, padString = ' ') {
  targetLength = targetLength >> 0; //floor if number or convert non-number to 0;
  padString = String(padString || ' ');
  if (str.length > targetLength) {
    return String(str);
  }
  else {
    targetLength = targetLength - str.length;
    if (targetLength > padString.length) {
      padString += padString.repeat(targetLength / padString.length); //append to original to ensure we are longer than needed
    }
    return padString.slice(0, targetLength) + String(str);
  }
}

export function list(staticModule) {
  const svs = new StaticFilesystem();
  svs.load(staticModule);
  const dir = [];
  const files = {};
  for (const each of svs.entries) {
    const st = svs.statSync(each);
    if (!st.isFile()) {
      dir.push(`${padStart('<dir>', 12)}   ${each}`);
    } else {
      files[each] = `${padStart(`${st.size}`, 12)}   ${each}`;
    }
  }
  for (const each of dir.sort()) {
    console.log(each);
  }
  for (const each of Object.keys(files).sort()) {
    console.log(files[each]);
  }
  svs.shutdown();
}

function existsInFs(svs, filePath) {
  try {
    return !!svs.statSync(filePath);
  } catch { }
  return false;
}

function existsFdInFs(svs, fd) {
  const pathForFD = svs.getPathForFD(fd);

  if (!pathForFD) {
    return false;
  }

  return existsInFs(svs, pathForFD);
}

export function load(staticModule) {
  if (!(global.__STATIC_FS_RUNTIME)) {
    global.__STATIC_FS_RUNTIME = {};
    const svs = new StaticFilesystem();

    // first patch the require 
    const undo_loader = patchModuleLoader(svs);
    const fsRFS = fs.readFileSync;
    const fsRPS = fs.realpathSync;
    const fsRDS = fs.readdirSync;
    const fsSS = fs.statSync;
    const fsRF = fs.readFile;
    const fsRP = fs.realpath;
    const fsRD = fs.readdir;
    const fsS = fs.stat;
    const fsO = fs.open;
    const fsC = fs.close;
    const fsCRS = fs.createReadStream;
    const fsFs = fs.fstat;
    const undo_fs = patchFilesystem({
      close: (fd, callback) => {
        if (existsFdInFs(svs, fd)) {
          return svs.close(fd, callback);
        }

        return fsC(fd, callback);
      },
      createReadStream: (path, options) => {
        if (existsInFs(svs, path)) {
          return svs.createReadStream(path, options);
        }

        return fsCRS(path, options);
      },
      fstat: (fd, options, callback) => {
        const sanitizedCallback = typeof callback === 'function' ? callback : options;

        if (existsFdInFs(svs, fd)) {
          return svs.fstat(fd, sanitizedCallback);
        }

        return fsFs(fd, options, callback);
      },
      open: (path, flags, mode, callback) => {
        const sanitizedCallback = typeof callback === 'function' ? callback : (typeof mode === 'function' ? mode : flags);

        if (existsInFs(svs, path)) {
          return svs.open(path, sanitizedCallback);
        }

        return fsO(path, flags, mode, callback);
      },
      readFileSync: (path, options) => {
        if (existsInFs(svs, path)) {
          return svs.readFileSync(path, options);
        }

        return fsRFS(path, options);
      },
      realpathSync: (path, options) => {
        if (existsInFs(svs, path)) {
          return svs.realpathSync(path);
        }

        return fsRPS(path, options);
      },
      readdirSync: (path, options) => {
        if (existsInFs(svs, path)) {
          return svs.readdirSync(path);
        }

        return fsRDS(path, options);
      },
      statSync: (path) => {
        if (existsInFs(svs, path)) {
          return svs.statSync(path);
        }

        return fsSS(path);
      },
      readFile: (path, options, callback) => {
        const sanitizedCallback = typeof callback === 'function' ? callback : options;
        const sanitizedOptions = (typeof options === 'object' || typeof options === 'string') ? options : null;

        if (existsInFs(svs, path)) {
          return svs.readFile(path, sanitizedOptions, sanitizedCallback);
        }

        return fsRF(path, options, callback);
      },
      realpath: (path, options, callback) => {
        const sanitizedCallback = typeof callback === 'function' ? callback : options;

        if (existsInFs(svs, path)) {
          return svs.realpath(path, sanitizedCallback);
        }

        return fsRP(path, options, callback);
      },
      readdir: (path, options, callback) => {
        const sanitizedCallback = typeof callback === 'function' ? callback : options;

        if (existsInFs(svs, path)) {
          return svs.readdir(path, sanitizedCallback);
        }

        return fsRD(path, options, callback);
      },
      stat: (path, options, callback) => {
        const sanitizedCallback = typeof callback === 'function' ? callback : options;

        if (existsInFs(svs, path)) {
          return svs.stat(path, sanitizedCallback);
        }

        return fsS(path, sanitizedCallback);
      },
      // TODO: We also need to at least implement readlink and readlinkSync
      // We can also implement fs.readJsonSync and fs.readJson
      // realpath should be fixed to recognize ../node_modules/module imports
      // native modules should be solved patching the native loader
      // support all node versions up to node 8
    });
    global.__STATIC_FS_RUNTIME.undo = () => { undo_fs(); undo_loader(); };
    global.__STATIC_FS_RUNTIME.staticfilesystem = svs;

    // hot-patch process.exit so that when it's called we shutdown the patcher early
    // can't just use the event because it's not early enough
    const process_exit = process.exit;
    process.exit = (n) => {
      // unlocks the files.
      svs.shutdown();

      // remove the patching
      global.__STATIC_FS_RUNTIME.undo();

      // keep going
      return process_exit(n);
    };

    const fork = child_process.fork;
    const spawn = child_process.spawn;
    const exec = child_process.exec;

    const spawnSync = child_process.spawnSync;
    const execSync = child_process.execSync;

    // hot-patch fork so we can make child processes work too.
    child_process.fork = (modulePath, args, options) => {
      const optsEnv = Object.assign({}, { STATIC_FS_ENV: true }, (options.env || {}));
      const staticFsEnv = optsEnv.STATIC_FS_ENV || process.env.STATIC_FS_ENV;
      if (args && staticFsEnv) {
        return fork(process.env.STATIC_FS_MAIN_RUNTIME_PATH, [...getInsertedArgs(svs.loadedVolumes), modulePath, ...Array.isArray(args) ? args : [args]], { ...options, env: staticFsEnv })
      } else {
        return fork(modulePath, args, options);
      }
    };

    // hot-patch spawn so we can patch if you're actually calling node.
    child_process.spawn = (command, args, options) => {
      const optsEnv = Object.assign({}, { STATIC_FS_ENV: true }, (options.env || {}));
      const staticFsEnv = optsEnv.STATIC_FS_ENV || process.env.STATIC_FS_ENV;
      if (args && (Array.isArray(args) || typeof args !== 'object') && isNode(command) && staticFsEnv) {
        return spawn(command, [process.env.STATIC_FS_MAIN_RUNTIME_PATH, ...getInsertedArgs(svs.loadedVolumes), ...Array.isArray(args) ? args : [args]], { ...options, env: staticFsEnv });
      }
      return spawn(command, args, options);
    };

    child_process.spawnSync = (command, args, options) => {
      const optsEnv = Object.assign({}, { STATIC_FS_ENV: true }, (options.env || {}));
      const staticFsEnv = optsEnv.STATIC_FS_ENV || process.env.STATIC_FS_ENV;
      if (args && (Array.isArray(args) || typeof args !== 'object') && isNode(command) && staticFsEnv) {
        return spawnSync(command, [process.env.STATIC_FS_MAIN_RUNTIME_PATH, ...getInsertedArgs(svs.loadedVolumes), ...Array.isArray(args) ? args : [args]], { ...options, env: staticFsEnv });
      }
      return spawnSync(command, args, options);
    };

    child_process.exec = (command, options, callback) => {
      const optsEnv = Object.assign({}, { STATIC_FS_ENV: true }, (options.env || {}));
      const staticFsEnv = optsEnv.STATIC_FS_ENV || process.env.STATIC_FS_ENV;
      const pos = startsWithNode(command);
      if (pos > -1 && staticFsEnv) {
        return exec(`${command.substring(0, pos)} "${process.env.STATIC_FS_MAIN_RUNTIME_PATH}" ${getInsertedArgString(svs.loadedVolumes)} ${command.substring(pos)}`, { ...options, env: staticFsEnv }, callback);
      }
      return exec(command, options, callback);
    };

    child_process.execSync = (command, options) => {
      const optsEnv = Object.assign({}, { STATIC_FS_ENV: true }, (options.env || {}));
      const staticFsEnv = optsEnv.STATIC_FS_ENV || process.env.STATIC_FS_ENV;
      const pos = startsWithNode(command);
      if (pos > -1 && staticFsEnv) {
        return execSync(`${command.substring(0, pos)} "${process.env.STATIC_FS_MAIN_RUNTIME_PATH}" ${getInsertedArgString(svs.loadedVolumes)} ${command.substring(pos)}`, { ...options, env: staticFsEnv });
      }
      return execSync(command, options);
    }
  }
  global.__STATIC_FS_RUNTIME.staticfilesystem.load(staticModule);

  if (!process.env.STATIC_FS_MAIN_RUNTIME_PATH && !process.env.STATIC_FS_ENV) {
    process.env.STATIC_FS_ENV = true;
    process.env.STATIC_FS_MAIN_RUNTIME_PATH = global.__STATIC_FS_RUNTIME.staticfilesystem.volumes[staticModule].runtimePath;
  }
}

export function unload(staticModule) {
  if (global.__STATIC_FS_RUNTIME.undo) {
    const svs = global.__STATIC_FS_RUNTIME.staticfilesystem;
    svs.unload(staticModule);
  }
}
