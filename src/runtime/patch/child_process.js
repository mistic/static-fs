import * as child_process from 'child_process';
import * as realFs from 'fs';

const nodeBinPossibilities = ['node', 'node.exe', process.execPath, process.argv[0]];

// assureCwdOnSanitizedOptions is needed as it is reasonable
// to declare cwd in the child_process function's options
// for resources bundled inside the static-fs volumes
// and in that case will not exist on the real filesystem.
// As nodejs uses uv_spawn to launch the child_process ultimately,
// that library would throw an error if the cwd does not exist
function assureCwdOnSanitizedOptions(options, sfs, existsOnRealFs) {
  const cwd = options && options.cwd;

  if (!cwd) {
    return;
  }

  try {
    const cwdStat = sfs.statSync(cwd);
    if (!!cwdStat && cwdStat.isDirectory() && !existsOnRealFs(cwd)) {
      realFs.mkdirSync(cwd, { recursive: true });
    }
  } catch {
    /* no-op */
  }
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

function indexAfterStartsWith(command, text) {
  return command.startsWith(text) ? text.length : -1;
}

function isNode(path) {
  return nodeBinPossibilities.indexOf(path) > -1;
}

function startsWithNode(command) {
  if (command.charAt(0) === '"') {
    // check includes quotes
    for (const each of nodeBinPossibilities) {
      const val = indexAfterStartsWith(command, `"${each}" `);
      if (val > -1) {
        return val;
      }
    }
  } else {
    for (const each of nodeBinPossibilities) {
      const val = indexAfterStartsWith(command, `${each} `);
      if (val > -1) {
        return val;
      }
    }
  }
  return -1;
}

function getEnvFromSanitizedOptions(sanitizedOptions) {
  const staticFsRequiredEnv = {
    STATIC_FS_ENV: process.env.STATIC_FS_ENV,
    STATIC_FS_MAIN_RUNTIME_PATH: process.env.STATIC_FS_MAIN_RUNTIME_PATH,
  };

  if (!sanitizedOptions) {
    return staticFsRequiredEnv;
  }

  if (sanitizedOptions.env) {
    return Object.assign(staticFsRequiredEnv, sanitizedOptions.env);
  }

  return process.env;
}

export function patchChildProcess(sfsRuntime) {
  const sfs = sfsRuntime.staticfilesystem;
  const fork = child_process.fork;
  const spawn = child_process.spawn;
  const exec = child_process.exec;
  const execFile = child_process.execFile;
  const execSync = child_process.execSync;
  const execFileSync = child_process.execFileSync;
  const spawnSync = child_process.spawnSync;

  child_process.fork = (modulePath, args, options) => {
    const sanitizedOptions = typeof args === 'object' && args.constructor === Object ? args : options || {};
    const sanitizedArgs = Array.isArray(args) ? args : [];
    const optsEnv = getEnvFromSanitizedOptions(sanitizedOptions);

    if (optsEnv.STATIC_FS_ENV) {
      // Note: the mainStaticFsRuntimePath is null because fork is a special case of spawn
      // that would get added as the first argument
      const builtArgs = buildStaticFsArgs(sanitizedArgs, null, sfs.loadedVolumes, modulePath);

      assureCwdOnSanitizedOptions(sanitizedOptions, sfs, realFs.existsSync);
      return fork(optsEnv.STATIC_FS_MAIN_RUNTIME_PATH, builtArgs, { ...sanitizedOptions, env: optsEnv });
    }

    return fork(modulePath, sanitizedArgs, sanitizedOptions);
  };

  child_process.spawn = (command, args, options) => {
    const sanitizedOptions = typeof args === 'object' && args.constructor === Object ? args : options || {};
    const sanitizedArgs = Array.isArray(args) ? args : [];
    const optsEnv = getEnvFromSanitizedOptions(sanitizedOptions);

    if (isNode(command) && optsEnv.STATIC_FS_ENV) {
      // Note: the mainEntry is null because that would be automatically
      // add in the new process as the first real argument of the new process
      const builtArgs = buildStaticFsArgs(sanitizedArgs, optsEnv.STATIC_FS_MAIN_RUNTIME_PATH, sfs.loadedVolumes);

      assureCwdOnSanitizedOptions(sanitizedOptions, sfs, realFs.existsSync);
      return spawn(command, builtArgs, { ...sanitizedOptions, env: optsEnv });
    }

    return spawn(command, sanitizedArgs, sanitizedOptions);
  };

  child_process.spawnSync = (command, args, options) => {
    const sanitizedOptions = typeof args === 'object' && args.constructor === Object ? args : options || {};
    const sanitizedArgs = Array.isArray(args) ? args : [];
    const optsEnv = getEnvFromSanitizedOptions(sanitizedOptions);

    if (isNode(command) && optsEnv.STATIC_FS_ENV) {
      const builtArgs = buildStaticFsArgs(sanitizedArgs, optsEnv.STATIC_FS_MAIN_RUNTIME_PATH, sfs.loadedVolumes);

      assureCwdOnSanitizedOptions(sanitizedOptions, sfs, realFs.existsSync);
      return spawnSync(command, builtArgs, { ...sanitizedOptions, env: optsEnv });
    }

    return spawnSync(command, sanitizedArgs, sanitizedOptions);
  };

  child_process.exec = (command, options, callback) => {
    const sanitizedOptions = typeof options === 'object' ? options : {};
    const sanitizedCallback = typeof options === 'function' ? options : callback;
    const optsEnv = getEnvFromSanitizedOptions(sanitizedOptions);
    const pos = startsWithNode(command);

    if (pos > -1 && optsEnv.STATIC_FS_ENV) {
      const builtArgs = buildStaticFsArgs(
        command.substring(pos),
        optsEnv.STATIC_FS_MAIN_RUNTIME_PATH,
        sfs.loadedVolumes,
      ).join(' ');

      assureCwdOnSanitizedOptions(sanitizedOptions, sfs, realFs.existsSync);
      return exec(
        `${command.substring(0, pos)} ${builtArgs}`,
        { ...sanitizedOptions, env: optsEnv },
        sanitizedCallback,
      );
    }

    return exec(command, sanitizedOptions, sanitizedCallback);
  };

  child_process.execSync = (command, options) => {
    const sanitizedOptions = typeof options === 'object' ? options : {};
    const optsEnv = getEnvFromSanitizedOptions(sanitizedOptions);
    const pos = startsWithNode(command);

    if (pos > -1 && optsEnv.STATIC_FS_ENV) {
      const builtArgs = buildStaticFsArgs(
        command.substring(pos),
        optsEnv.STATIC_FS_MAIN_RUNTIME_PATH,
        sfs.loadedVolumes,
      ).join(' ');

      assureCwdOnSanitizedOptions(sanitizedOptions, sfs, realFs.existsSync);
      return execSync(`${command.substring(0, pos)} ${builtArgs}`, { ...sanitizedOptions, env: optsEnv });
    }

    return execSync(command, sanitizedOptions);
  };

  child_process.execFile = (file, args, options, callback) => {
    const sanitizedCallback = typeof options === 'function' ? options : typeof args === 'function' ? args : callback;
    const sanitizedOptions = typeof args === 'object' && args.constructor === Object ? args : options || {};
    const sanitizedArgs = Array.isArray(args) ? args : [];
    const optsEnv = getEnvFromSanitizedOptions(sanitizedOptions);

    if (isNode(file) && optsEnv.STATIC_FS_ENV) {
      const builtArgs = buildStaticFsArgs(sanitizedArgs, optsEnv.STATIC_FS_MAIN_RUNTIME_PATH, sfs.loadedVolumes);

      assureCwdOnSanitizedOptions(sanitizedOptions, sfs, realFs.existsSync);
      return execFile(file, builtArgs, { ...sanitizedOptions, env: optsEnv }, sanitizedCallback);
    }

    return execFile(file, sanitizedArgs, sanitizedOptions, sanitizedCallback);
  };

  child_process.execFileSync = (file, args, options) => {
    const sanitizedOptions = typeof args === 'object' && args.constructor === Object ? args : options || {};
    const sanitizedArgs = Array.isArray(args) ? args : [];
    const optsEnv = getEnvFromSanitizedOptions(sanitizedOptions);

    if (isNode(file) && optsEnv.STATIC_FS_ENV) {
      const builtArgs = buildStaticFsArgs(sanitizedArgs, optsEnv.STATIC_FS_MAIN_RUNTIME_PATH, sfs.loadedVolumes);

      assureCwdOnSanitizedOptions(sanitizedOptions, sfs, realFs.existsSync);
      return execFileSync(file, builtArgs, { ...sanitizedOptions, env: optsEnv });
    }

    return execFileSync(file, sanitizedArgs, sanitizedOptions);
  };

  return () => {
    child_process.fork = fork;
    child_process.spawn = spawn;
    child_process.exec = exec;
    child_process.spawnSync = spawnSync;
    child_process.execSync = execSync;
  };
}
