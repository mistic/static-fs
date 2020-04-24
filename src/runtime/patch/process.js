export function patchProcess(sfsRuntime) {
  // hot-patch process.exit so when it's called we shutdown the patcher early.
  // we can't just use the event because it's not early enough
  const process_exit = process.exit;

  // setup exit fn
  let exitWasCalled = false;
  const exitFn = (n) => {
    if (!exitWasCalled) {
      exitWasCalled = true;

      // unlocks the files and
      // remove and undo all the patches
      sfsRuntime.undo();
    }

    process_exit(n);
  };

  // apply patches
  // main exit patch
  process.exit = exitFn;

  // special patch for pm2 cluster shutdown message
  const msgListener = (msg) => {
    if (msg === 'shutdown') {
      exitFn(0);
    }
  };
  process.on('message', msgListener);

  return () => {
    // just to assure after removing the patch
    // sigint and sigterm once patches are not called
    exitWasCalled = true;

    process.exit = process_exit;
    process.removeListener('message', msgListener);
  };
}
