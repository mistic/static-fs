<h1 align="center">
  static-fs
</h1> 

[![CI Build Status][ci-build-status-image]][ci-build-status-url]
[![Commitizen Friendly][commitizen-friendly-image]][commitizen-friendly-url]
[![NPM Version][npm-version-image]][npm-version-url]
[![NODE Version][node-version-image]][node-version-url]
[![David Node Deps Manager][david-node-deps-manager-image]][david-node-deps-manager-url]
[![David Node Deps Manager Development][david-node-deps-manager-dev-image]][david-node-deps-manager-dev-url]
[![NPM Install Size][npm-install-size-image]][npm-install-size-url]


A static filesystem to bundle multiple files into one that are lately
able to be read by Node.js through `require` or the [fs module](https://nodejs.org/api/fs.html).

## Why

There are a lot of use cases when we have the need to ship the `node_modules` 
along with the distribution files of our code in order to achieve a `zero install` 
workflow for our end users. As the application evolves so the `node_modules` number 
of files which would cause a lot of problems specially on `windows` environments 
(bad performance unzipping, bad performance through an installer,  max file path length, etc).

That was the first motivation and the main use case for the static filesystem: 
allow to bundle all the files from the `node_modules` during the build process into a single file 
and then, in runtime, force node to first look into that statically generated 
filesystem when searching for a file and only look in the real filesystem 
in case the file is not found on the static one.

While the main use case is the above there could be others like for example shipping almost 
every product file in a statically generated filesystem so we can make the product structure 
simple and transparent for the end user. The only thing to keep in mind is `that 
tool was designed to be used during a build process` under certain assumptions.

## Features

- Pack multiple files into a single one called static filesystem that would 
mount relatively to the parent directory where it is generated

- Patches `require`, `fs and child_process` to be able to read 
from the static filesystem

- Run multiple static filesystem per application

- One single build step tool that works out of the box

## Getting Started

Remember, that is a development tool intended to be used during your 
build process, so install it as `development dependency` and run it as 
a one final step once your build produce the raw distributable artifacts.

### Install

`npm install --save-dev static-fs`

### Usage

**Generate a static filesystem volume**
```javascript
// example_build_step.js

const { generateStaticFsVolume } = require('static-fs');
const { resolve } = require('path');

// one example of a dependency to delete files in bulk, you can use any other
const del = require('del');

(async () => {
  const mountRoot = resolve('../../'), 
    folderToAdd = resolve('../../node_modules'),
    entryPoint = resolve('../../index.js');
  
  // Generate a static filesystem volume
  const addedFiles = await generateStaticFsVolume(
    mountRoot,
    [
      folderToAdd
    ],
    [
      entryPoint
    ]
    //, [] -> exclusions are optional and equal to [] by default
  );
  
  // Delete all the files bundled into the static filesystem volume
  await del(addedFiles, { force: true });
})()
```

**Run your app**

Just run `node index.js` (which was the entryPoint we assume for that example) 
in the root of your distributable app folder and everything should work. 

## API

### `async generateStaticFsVolume(mountRootDir, foldersToAdd, appEntryPointsToPatch, exclusions)`

An async function that would take care of generating the static filesystem 
considering that the root path to mount it would be `mountRootDir`, the content 
would be created according `foldersToAdd`, your application entry points 
would be automatically patched according `appEntryPointsToPatch` so node can read 
from the generated static filesystem, and any path (folder or file) listed on `exclusions`
would be discarded.

> NOTE: After running that function a folder called `static_fs` would be 
created inside `mountRootDir` with `static_fs_volume.sfsv` and 
`static_fs_runtime.js`.

**Params** 

- `mountRootDir: string`: Path for the root path of the contained files 
into that static filesystem instance

- `foldersToAdd: string[]`: List of paths of folders containing the files 
to bundle inside that static filesystem instance. Could not be the same as 
`mountRootDir`.

- `appEntryPointsToPatch: string[]`: List of paths for the application entry points 
to be patched in order to read from the static filesystem.

- `exclusions: string[] = []`: List of paths that would explicit not be included by 
the static filesystem during the generation phase. The paths on this list could 
be a folder or a single file and they should be absolute resolved against 
`mountRootDir` otherwise the function would throw an error. In case the path 
is a folder, the entire folder and children would be also excluded. 

**Returns**

An `string[]` containing the paths of each file and base folder 
that was added into this static filesystem instance. 

## Known Limitations

A little set of things are not supported by the static filesystem. They can 
be summarised in the following list:

- `.node` native modules files are not supported inside the static filesystem. 
They will be excluded during the generation phase and are expected to be present 
in the original location on the real filesystem.

- Like the above mentioned `.node` files, every other platform-specific files that
requires to be compiled, processed or any other changing operation during runtime are 
not supported inside the static filesystem. As they won't be excluded automatically, 
they should not be included inside the static filesystem during the generation phase. 

- While this is more a design choice than a limitation we choose to list it 
here: any write operation is not supported against the static filesystem during runtime.
It would mimic the file state at the time it was generated.

Let us know if you found other unknown limitations [opening an issue](https://github.com/mistic/static-fs/issues/new).

## Contributing

If you wanna contribute please read [CONTRIBUTING.md](https://github.com/mistic/static-fs/blob/master/CONTRIBUTING.md).

## License

See [LICENSE](https://github.com/mistic/static-fs/blob/master/LICENSE).

## Thanks To

- @zeit for [Pkg](https://github.com/zeit/pkg) as it was the first project we 
  start investigate in order to solve that problem and was also source of some ideas.
- @fearthecowboy for [static-link](https://github.com/fearthecowboy/static-link) as 
  it was the main inspiration for that project (it's codebase was used as the starting point for the current project).
- @electron for [asar](https://github.com/electron/asar). While we found it in a later stage 
  of that project it was curious to understand how both projects share some of the same ideas,
  however still capable of achieving different results and different implementations.
  
[ci-build-status-image]: https://dev.azure.com/static-fs/static-fs/_apis/build/status/mistic.static-fs?branchName=master 
[ci-build-status-url]: https://dev.azure.com/static-fs/static-fs/_build/latest?definitionId=1&branchName=master
[commitizen-friendly-image]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-friendly-url]: http://commitizen.github.io/cz-cli
[npm-version-image]: https://img.shields.io/npm/v/static-fs
[npm-version-url]: https://www.npmjs.com/package/static-fs
[node-version-image]: https://img.shields.io/node/v/static-fs
[node-version-url]: https://nodejs.org/download/release/v10.19.0
[david-node-deps-manager-image]: https://img.shields.io/david/mistic/static-fs
[david-node-deps-manager-url]: https://david-dm.org/mistic/static-fs
[david-node-deps-manager-dev-image]: https://img.shields.io/david/dev/mistic/static-fs
[david-node-deps-manager-dev-url]: https://david-dm.org/mistic/static-fs?type=dev
[npm-install-size-image]: https://packagephobia.now.sh/badge?p=static-fs
[npm-install-size-url]: https://packagephobia.now.sh/result?p=static-fs
