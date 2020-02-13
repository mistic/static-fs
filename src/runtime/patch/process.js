export function patchProcess(sfsRuntime) {
  // hot-patch process.exit so when it's called we shutdown the patcher early.
  // we can't just use the event because it's not early enough
  const process_exit = process.exit;
  process.exit = (n) => {
    // unlocks the files.
    sfsRuntime.staticfilesystem.shutdown();

    // remove and undo all the patches
    sfsRuntime.undo();

    // keep going
    return process_exit(n);
  };

  return () => {
    process.exit = process_exit;
  };
}
