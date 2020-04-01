import * as realFs from 'fs';
import * as Module from 'module';
import { StaticFilesystem } from '../filesystem';
import { patchChildProcess, patchFilesystem, patchModuleLoader, patchProcess } from './patch';

if (isRunningAsEntry()) {
  // this is used when we are forking a child process
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

      // Load volumes in the argument
      while (i < process.argv.length && process.argv[i].startsWith('--static-fs-volumes=')) {
        const staticFsVolume = process.argv[i].split('=')[1];
        process.argv.splice(i, 1);
        load(staticFsVolume);
      }

      // exit when arguments are missing
      if (process.argv.length < 2) {
        // eslint-disable-next-line no-console
        console.log('Missing the module name to start with');
        process.exit(1);
      }

      // Load the main module
      Module._load(process.argv[1], null, true);

      // Handle any pending ticks
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

export function shutdown() {
  if (global.__STATIC_FS_RUNTIME.undo) {
    global.__STATIC_FS_RUNTIME.staticfilesystem.shutdown();
    global.__STATIC_FS_RUNTIME.staticfilesystem.undo();

    // remove static-fs state control env vars
    delete global.__STATIC_FS_RUNTIME;
    delete process.env.STATIC_FS_ENV;
    delete process.env.STATIC_FS_MAIN_RUNTIME_PATH;
  }
}
