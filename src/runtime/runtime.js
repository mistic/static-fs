import * as realFs from 'fs';
import * as Module from 'module';
import { StaticFilesystem } from '../filesystem';
import { patchChildProcess, patchFilesystem, patchModuleLoader, patchProcess } from './patch';

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
    startPath = realFs.realpathSync(currentRuntimePath);
  } catch {
    /* no-op */
  }

  if (!startPath) {
    // eslint-disable-next-line no-console
    console.log('Cannot resolve the current static fs runtime file path');
    process.exit(1);
  }

  for (let i = 0; i < process.argv.length; i++) {
    if (realFs.realpathSync(process.argv[i]) === startPath) {
      process.argv.splice(i, 1);
      while (i < process.argv.length && process.argv[i].startsWith('--static-fs-volumes=')) {
        const staticFsVolume = process.argv[i].split('=')[1];
        process.argv.splice(i, 1);
        load(staticFsVolume);
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

function isRunningAsEntry() {
  return require.main === module || (process && process.env && process.env.STATIC_FS_ENV);
}

export function load(staticFsVolume) {
  if (!global.__STATIC_FS_RUNTIME) {
    global.__STATIC_FS_RUNTIME = {};
    global.__STATIC_FS_RUNTIME.staticfilesystem = new StaticFilesystem();

    // patch module_loader (require fn)
    const undo_loader = patchModuleLoader(global.__STATIC_FS_RUNTIME);

    // patch fs
    const undo_fs = patchFilesystem(global.__STATIC_FS_RUNTIME);

    // patch process
    const undo_process = patchProcess(global.__STATIC_FS_RUNTIME);

    // patch child_process
    const undo_child_process = patchChildProcess(global.__STATIC_FS_RUNTIME);

    global.__STATIC_FS_RUNTIME.undo = () => {
      undo_child_process();
      undo_process();
      undo_fs();
      undo_loader();
    };
  }
  global.__STATIC_FS_RUNTIME.staticfilesystem.load(staticFsVolume);

  if (!process.env.STATIC_FS_MAIN_RUNTIME_PATH || !process.env.STATIC_FS_ENV) {
    process.env.STATIC_FS_ENV = true;
    process.env.STATIC_FS_MAIN_RUNTIME_PATH =
      global.__STATIC_FS_RUNTIME.staticfilesystem.volumes[staticFsVolume].runtimePath;
  }
}

export function unload(staticFsVolume) {
  if (global.__STATIC_FS_RUNTIME.undo) {
    global.__STATIC_FS_RUNTIME.staticfilesystem.unload(staticFsVolume);
  }
}
