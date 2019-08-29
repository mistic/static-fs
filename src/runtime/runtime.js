import * as fs from 'fs';
import * as child_process from 'child_process';
import * as Module from 'module';
import { StaticFilesystem } from '../filesystem';
import { patchFilesystem } from './patch/filesystem';
import { patchModuleLoader } from './patch/module_loader';

if (isRunningAsEntry()) {
  // this is for "fork mode" where we are forking a child process.
  // the first parameter should be this file.
  // the following parameter should be the static module file.
  const currentRuntimePath = process.env.STATIC_FS_MAIN_RUNTIME_PATH || module.filename;
  let startPath = null;

  // Remove parent env vars
  // In case the load succeeds they will
  // be added again in the end of the load
  delete process.env.STATIC_FS_ENV;
  delete process.env.STATIC_FS_MAIN_RUNTIME_PATH;

  try {
    startPath = fs.realpathSync(currentRuntimePath);
  } catch {
    /* no-op */
  }

  if (!startPath) {
    // eslint-disable-next-line no-console
    console.log('Cannot resolve the current static fs runtime file path');
    process.exit(1);
  }

  for (let i = 0; i < process.argv.length; i++) {
    if (fs.realpathSync(process.argv[i]) === startPath) {
      process.argv.splice(i, 1);
      while (i < process.argv.length && process.argv[i].startsWith('--static-fs-volumes=')) {
        const staticModule = process.argv[i].split('=')[1];
        process.argv.splice(i, 1);
        load(staticModule);
      }
      if (process.argv.length < 2) {
        // eslint-disable-next-line no-console
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

const possibilities = ['node', 'node.exe', process.execPath, process.argv[0]];

function isRunningAsEntry() {
  return require.main === module || (process && process.env && process.env.STATIC_FS_ENV);
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
        return val;
      }
    }
  } else {
    for (const each of possibilities) {
      const val = indexAfterStartsWith(command, `${each} `);
      if (val > -1) {
        return val;
      }
    }
  }
  return -1;
}

// Build the args order for the child_process functions
// The order is always the same:
// 1 - first add the arguments starting with -- or -
// 2 - add the main static fs runtime path
// 3 - add the static-fs-volumes flag
// 4 - add the main entry
// 5 - add the rest of the args
//
// However for fork the order is different as fork don't accept
// node args starting by -- or - unless we set the options.execArgs
// So for fork (when mainStaticFsRuntimePath === null) the order is
//
// 1 - add the static-fs-volumes flag
// 2 - add the main entry
// 3 - add the rest of the args
function buildStaticFsArgs(args, mainStaticFsRuntimePath, staticFsVolumesPaths, mainEntry = null) {
  const sanitizedArgs = Array.isArray(args) ? args : typeof args === 'string' ? args.split(' ') : [];
  const builtArgs = [];
  let toAddMetaArgs = true;

  const iterableArgs = [...sanitizedArgs];

  do {
    const wasArrayEmptyBeforeArg = iterableArgs.length === 0;
    const arg = iterableArgs.shift();

    if (!arg && !wasArrayEmptyBeforeArg) {
      return;
    }

    if ((typeof arg === 'string' && arg.startsWith('-') && mainStaticFsRuntimePath) || !toAddMetaArgs) {
      builtArgs.push(arg);
      continue;
    }

    toAddMetaArgs = false;

    if (mainStaticFsRuntimePath) {
      builtArgs.push(mainStaticFsRuntimePath);
    }

    builtArgs.push(`--static-fs-volumes=${staticFsVolumesPaths.join(',')}`);

    if (mainEntry) {
      builtArgs.push(mainEntry);
    }

    builtArgs.push(arg);
  } while (iterableArgs.length > 0);

  if (!builtArgs.length) {
    throw new Error('Something went wrong building the static fs args for the child_process functions');
  }

  return builtArgs;
}

function padStart(str, targetLength, padString = ' ') {
  targetLength = targetLength >> 0; //floor if number or convert non-number to 0;
  padString = String(padString || ' ');
  if (str.length > targetLength) {
    return String(str);
  } else {
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
      dir.push(`${padStart('{dir}', 12)}   ${each}`);
    } else {
      files[each] = `${padStart(`${st.size}`, 12)}   ${each}`;
    }
  }
  for (const each of dir.sort()) {
    // eslint-disable-next-line no-console
    console.log(each);
  }
  for (const each of Object.keys(files).sort()) {
    // eslint-disable-next-line no-console
    console.log(files[each]);
  }
  svs.shutdown();
}

function existsInFs(svs, filePath) {
  try {
    return !!svs.statSync(filePath);
  } catch {
    /* no-op */
  }
  return false;
}

function existsFdInFs(svs, fd) {
  try {
    svs.getValidatedFD(fd);
    return existsInFs(svs, fd.filePath);
  } catch {
    /* no-op */
  }
  return false;
}

function assureCwdOnSanitizedOptions(options, svs, existsOnRealFs) {
  const cwd = options && options.cwd;

  if (!cwd) {
    return;
  }

  try {
    const cwdStat = svs.statSync(cwd);
    if (!!cwdStat && cwdStat.isDirectory() && !existsOnRealFs(cwd)) {
      fs.mkdirSync(cwd, { recursive: true });
    }
  } catch {
    /* no-op */
  }
}

export function load(staticModule) {
  if (!global.__STATIC_FS_RUNTIME) {
    global.__STATIC_FS_RUNTIME = {};
    const svs = new StaticFilesystem();

    // first patch the require
    const undo_loader = patchModuleLoader(svs);
    const fsRFS = fs.readFileSync;
    const fsRPS = fs.realpathSync;
    const fsRDS = fs.readdirSync;
    const fsSS = fs.statSync;
    const fsES = fs.existsSync;
    const fsRF = fs.readFile;
    const fsRP = fs.realpath;
    const fsRD = fs.readdir;
    const fsS = fs.stat;
    const fsO = fs.open;
    const fsC = fs.close;
    const fsCRS = fs.createReadStream;
    const fsFs = fs.fstat;
    const fsE = fs.exists;

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
        const sanitizedCallback = typeof callback === 'function' ? callback : typeof mode === 'function' ? mode : flags;

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
      existsSync: (path) => {
        return existsInFs(svs, path) || fsES(path);
      },
      readFile: (path, options, callback) => {
        const sanitizedCallback = typeof callback === 'function' ? callback : options;
        const sanitizedOptions = typeof options === 'object' || typeof options === 'string' ? options : null;

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
      exists: (path, callback) => {
        if (existsInFs(svs, path)) {
          callback(true);
          return;
        }

        return fsE(path, callback);
      },
    });
    global.__STATIC_FS_RUNTIME.undo = () => {
      undo_fs();
      undo_loader();
    };
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
      const sanitizedOptions = args && typeof args === 'object' && args.constructor === Object ? args : options || {};
      const sanitizedArgs = Array.isArray(args) ? args : [];
      const optsEnv = Object.assign(process.env, sanitizedOptions.env || {});
      // Note: the mainStaticFsRuntimePath is null because fork is a special case of spawn
      // that would get added as the first argument
      const builtArgs = buildStaticFsArgs(sanitizedArgs, null, svs.loadedVolumes, modulePath);
      if (args && optsEnv.STATIC_FS_ENV) {
        assureCwdOnSanitizedOptions(sanitizedOptions, svs, fsES);
        return fork(process.env.STATIC_FS_MAIN_RUNTIME_PATH, builtArgs, { ...sanitizedOptions, env: optsEnv });
      } else {
        return fork(modulePath, args, options);
      }
    };

    // hot-patch spawn so we can patch if you're actually calling node.
    child_process.spawn = (command, args, options) => {
      const sanitizedOptions = args && typeof args === 'object' && args.constructor === Object ? args : options || {};
      const optsEnv = Object.assign(process.env, sanitizedOptions.env || {});
      // Note: the mainEntry is null because that would be automatically
      // add in the new process as the first real argument of the new process
      const builtArgs = buildStaticFsArgs(args, process.env.STATIC_FS_MAIN_RUNTIME_PATH, svs.loadedVolumes);
      if (args && (Array.isArray(args) || typeof args !== 'object') && isNode(command) && optsEnv.STATIC_FS_ENV) {

        // NOTE: that  assureCwdOnSanitizedOptions is needed as it is reasonable
        // to declare cwd for the spawn that is bundled inside the static-fs volumes
        // and in that case will not exist on the real filesystem.
        // As nodejs uses uv_spawn to launch the child_process ultimately,
        // that library would throw an error if the cwd does not exist
        assureCwdOnSanitizedOptions(sanitizedOptions, svs, fsES);
        return spawn(command, builtArgs, { ...sanitizedOptions, env: optsEnv });
      }
      return spawn(command, args, options);
    };

    child_process.spawnSync = (command, args, options) => {
      const sanitizedOptions = args && typeof args === 'object' && args.constructor === Object ? args : options || {};
      const optsEnv = Object.assign(process.env, sanitizedOptions.env || {});
      const builtArgs = buildStaticFsArgs(args, process.env.STATIC_FS_MAIN_RUNTIME_PATH, svs.loadedVolumes);
      if (args && (Array.isArray(args) || typeof args !== 'object') && isNode(command) && optsEnv.STATIC_FS_ENV) {
        assureCwdOnSanitizedOptions(sanitizedOptions, svs, fsES);
        return spawnSync(command, builtArgs, { ...sanitizedOptions, env: optsEnv });
      }
      return spawnSync(command, args, options);
    };

    child_process.exec = (command, options, callback) => {
      const sanitizedOptions = options && typeof options === 'object' ? options : {};
      const optsEnv = Object.assign(process.env, sanitizedOptions.env || {});
      const pos = startsWithNode(command);
      if (pos > -1 && optsEnv.STATIC_FS_ENV) {
        const builtArgs = buildStaticFsArgs(
          command.substring(pos),
          process.env.STATIC_FS_MAIN_RUNTIME_PATH,
          svs.loadedVolumes,
        ).join(' ');

        assureCwdOnSanitizedOptions(sanitizedOptions, svs, fsES);
        return exec(`${command.substring(0, pos)} ${builtArgs}`, { ...sanitizedOptions, env: optsEnv }, callback);
      }
      return exec(command, options, callback);
    };

    child_process.execSync = (command, options) => {
      const sanitizedOptions = options && typeof options === 'object' ? options : {};
      const optsEnv = Object.assign(process.env, sanitizedOptions.env || {});
      const pos = startsWithNode(command);
      if (pos > -1 && optsEnv.STATIC_FS_ENV) {
        const builtArgs = buildStaticFsArgs(
          command.substring(pos),
          process.env.STATIC_FS_MAIN_RUNTIME_PATH,
          svs.loadedVolumes,
        ).join(' ');

        assureCwdOnSanitizedOptions(sanitizedOptions, svs, fsES);
        return execSync(`${command.substring(0, pos)} ${builtArgs}`, { ...sanitizedOptions, env: optsEnv });
      }
      return execSync(command, options);
    };
  }
  global.__STATIC_FS_RUNTIME.staticfilesystem.load(staticModule);

  if (!process.env.STATIC_FS_MAIN_RUNTIME_PATH || !process.env.STATIC_FS_ENV) {
    process.env.STATIC_FS_ENV = true;
    process.env.STATIC_FS_MAIN_RUNTIME_PATH =
      global.__STATIC_FS_RUNTIME.staticfilesystem.volumes[staticModule].runtimePath;
  }
}

export function unload(staticModule) {
  if (global.__STATIC_FS_RUNTIME.undo) {
    const svs = global.__STATIC_FS_RUNTIME.staticfilesystem;
    svs.unload(staticModule);
  }
}
