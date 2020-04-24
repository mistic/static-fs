'use strict';
const execSync = require('child_process').execSync;

const exec = (command) => {
  execSync(command, {
    stdio: [0, 1, 2]
  });
};

const shouldWeRunPrePublish = () => {
  try {
    const npm_config_argv = JSON.parse(process.env['npm_config_argv'] || '');

    if (typeof npm_config_argv !== 'object'
      || !npm_config_argv.cooked
      || !npm_config_argv.cooked instanceof Array ) {
      process.exit(1);
    }

    let val;
    while ((val = npm_config_argv.cooked.shift()) !== undefined) {
      if (/^-/.test(val)) continue;
      if (/^(add|install)$/.test(val)) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
};

if (shouldWeRunPrePublish()) {
  exec('yarn run build');
}
