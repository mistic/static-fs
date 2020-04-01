# Static-Fs Changelog

## [1.8.3](https://github.com/mistic/static-fs/compare/v1.8.2...v1.8.3) (2020-04-01)


### Bug Fixes

* memory explosion waiting for all promises when writing a volume ([#193](https://github.com/mistic/static-fs/issues/193)) ([127bb86](https://github.com/mistic/static-fs/commit/127bb8691a424b2f31768db048551aa81b9b96ee))

## [1.8.2](https://github.com/mistic/static-fs/compare/v1.8.1...v1.8.2) (2020-03-21)


### Bug Fixes

* error for path argument check fn ([#183](https://github.com/mistic/static-fs/issues/183)) ([b690b94](https://github.com/mistic/static-fs/commit/b690b94dca542d4f577296c7377e263c4e76781b))

## [1.8.1](https://github.com/mistic/static-fs/compare/v1.8.0...v1.8.1) (2020-03-21)


### Bug Fixes

* createReadStream path processing ([#182](https://github.com/mistic/static-fs/issues/182)) ([bcc0a16](https://github.com/mistic/static-fs/commit/bcc0a1688beb7946a276fd8be90df961c8dbd4ca))

# [1.8.0](https://github.com/mistic/static-fs/compare/v1.7.0...v1.8.0) (2020-03-21)


### Features

* throw error when non read flags are used ([#181](https://github.com/mistic/static-fs/issues/181)) ([61921f1](https://github.com/mistic/static-fs/commit/61921f1bbc9f880164f23bb2f6cf491775c80cd0))

# [1.7.0](https://github.com/mistic/static-fs/compare/v1.6.7...v1.7.0) (2020-03-21)


### Features

* patch execFile and execFileSync ([#180](https://github.com/mistic/static-fs/issues/180)) ([c0926c7](https://github.com/mistic/static-fs/commit/c0926c723739ab0c058f6425bda72a268ed1a26d))

## [1.6.7](https://github.com/mistic/static-fs/compare/v1.6.6...v1.6.7) (2020-03-21)


### Bug Fixes

* correctly process child_process env vars ([#179](https://github.com/mistic/static-fs/issues/179)) ([620c971](https://github.com/mistic/static-fs/commit/620c9710102c2ca504476c7d14a9fb1ca6cd15a3))

## [1.6.6](https://github.com/mistic/static-fs/compare/v1.6.5...v1.6.6) (2020-03-20)


### Bug Fixes

* preserve use strict on patches applied by generator ([#178](https://github.com/mistic/static-fs/issues/178)) ([7e5acc9](https://github.com/mistic/static-fs/commit/7e5acc9c31412270cf28d9e36b4ca3e796f91c3f))

## [1.6.5](https://github.com/mistic/static-fs/compare/v1.6.4...v1.6.5) (2020-03-20)


### Bug Fixes

* use relative paths in the manifest file ([#177](https://github.com/mistic/static-fs/issues/177)) ([366701d](https://github.com/mistic/static-fs/commit/366701d3728dd210815eff1e2066bc0d5f07c7ad))

## [1.6.4](https://github.com/mistic/static-fs/compare/v1.6.3...v1.6.4) (2020-03-12)


### Bug Fixes

* readable volume readSync cache ([#173](https://github.com/mistic/static-fs/issues/173)) ([31f8995](https://github.com/mistic/static-fs/commit/31f8995f218380e97fb5e2a6b21f0cf3e46c439b))

## [1.6.3](https://github.com/mistic/static-fs/compare/v1.6.2...v1.6.3) (2020-03-11)


### Bug Fixes

* call promisify once in promises patch api and apply correct handling for process exit ([#172](https://github.com/mistic/static-fs/issues/172)) ([495b804](https://github.com/mistic/static-fs/commit/495b804))

## [1.6.2](https://github.com/mistic/static-fs/compare/v1.6.1...v1.6.2) (2020-02-28)


### Bug Fixes

* memory expensive implementation ([#163](https://github.com/mistic/static-fs/issues/163)) ([3f49119](https://github.com/mistic/static-fs/commit/3f49119))

## [1.6.1](https://github.com/mistic/static-fs/compare/v1.6.0...v1.6.1) (2020-02-22)


### Bug Fixes

* update deps causing random errors ([#160](https://github.com/mistic/static-fs/issues/160)) ([a7e8c57](https://github.com/mistic/static-fs/commit/a7e8c57))

# [1.6.0](https://github.com/mistic/static-fs/compare/v1.5.0...v1.6.0) (2020-02-20)


### Features

* apply options on readdir,stat and realpath ([#155](https://github.com/mistic/static-fs/issues/155)) ([e47abe8](https://github.com/mistic/static-fs/commit/e47abe8))

# [1.5.0](https://github.com/mistic/static-fs/compare/v1.4.0...v1.5.0) (2020-02-14)


### Features

* look into real fs first and then into static fs to allow overrides ([#150](https://github.com/mistic/static-fs/issues/150)) ([b86c49e](https://github.com/mistic/static-fs/commit/b86c49e))
* sorted manifest file content ([#151](https://github.com/mistic/static-fs/issues/151)) ([e05c8cc](https://github.com/mistic/static-fs/commit/e05c8cc))

# [1.4.0](https://github.com/mistic/static-fs/compare/v1.3.0...v1.4.0) (2020-01-29)


### Features

* **na:** generate a manifest for each static_fs volume ([#139](https://github.com/mistic/static-fs/issues/139)) ([f232bd6](https://github.com/mistic/static-fs/commit/f232bd6))

# [1.3.0](https://github.com/mistic/static-fs/compare/v1.2.2...v1.3.0) (2020-01-28)


### Features

* include top level directory in the added files when not excluded ([#137](https://github.com/mistic/static-fs/issues/137)) ([9a770db](https://github.com/mistic/static-fs/commit/9a770db))

## [1.2.2](https://github.com/mistic/static-fs/compare/v1.2.1...v1.2.2) (2020-01-27)


### Bug Fixes

* **na:** readdir method in the static-fs to also consider real fs ([#136](https://github.com/mistic/static-fs/issues/136)) ([19deb7d](https://github.com/mistic/static-fs/commit/19deb7d))

## [1.2.1](https://github.com/mistic/static-fs/compare/v1.2.0...v1.2.1) (2020-01-27)


### Bug Fixes

* multiple problems with the patch api ([#134](https://github.com/mistic/static-fs/issues/134)) ([770b762](https://github.com/mistic/static-fs/commit/770b762))

# [1.2.0](https://github.com/mistic/static-fs/compare/v1.1.1...v1.2.0) (2019-08-29)


### Features

* create nodejs custom symbols for fs module ([#70](https://github.com/mistic/static-fs/issues/70)) ([69cfdd8](https://github.com/mistic/static-fs/commit/69cfdd8))

## [1.1.1](https://github.com/mistic/static-fs/compare/v1.1.0...v1.1.1) (2019-08-29)


### Bug Fixes

* assure cwd on child_process functions options exists on filesystem ([#68](https://github.com/mistic/static-fs/issues/68)) ([ac501cf](https://github.com/mistic/static-fs/commit/ac501cf))

# [1.1.0](https://github.com/mistic/static-fs/compare/v1.0.2...v1.1.0) (2019-08-29)


### Features

* add static fs implementation for existsSync and exists ([#66](https://github.com/mistic/static-fs/issues/66)) ([5e647f8](https://github.com/mistic/static-fs/commit/5e647f8))

## [1.0.2](https://github.com/mistic/static-fs/compare/v1.0.1...v1.0.2) (2019-08-27)


### Bug Fixes

* do not apply default encoding on fs.readFileSync ([#65](https://github.com/mistic/static-fs/issues/65)) ([1293c57](https://github.com/mistic/static-fs/commit/1293c57))

## [1.0.1](https://github.com/mistic/static-fs/compare/v1.0.0...v1.0.1) (2019-08-24)


### Bug Fixes

* static fs build args for child process functions ([#62](https://github.com/mistic/static-fs/issues/62)) ([875e508](https://github.com/mistic/static-fs/commit/875e508))

# 1.0.0 (2019-08-23)


### Bug Fixes

* child process function setup ([b3eb776](https://github.com/mistic/static-fs/commit/b3eb776))
* child_process patch functions ([17b042e](https://github.com/mistic/static-fs/commit/17b042e))
* correctly apply defaults order for static fs file stats ([#43](https://github.com/mistic/static-fs/issues/43)) ([33195ca](https://github.com/mistic/static-fs/commit/33195ca))
* files with .node in the name not as extension should be included ([#39](https://github.com/mistic/static-fs/issues/39)) ([8b7a885](https://github.com/mistic/static-fs/commit/8b7a885))
* require or read from relative paths ([#33](https://github.com/mistic/static-fs/issues/33)) ([ac8e27e](https://github.com/mistic/static-fs/commit/ac8e27e))
* wrong comparision between unix path and raw mounting root path ([#41](https://github.com/mistic/static-fs/issues/41)) ([e11165c](https://github.com/mistic/static-fs/commit/e11165c))


### Features

* add stream support to read in chunks from the static fs. ([95e5a7e](https://github.com/mistic/static-fs/commit/95e5a7e))
* multiple filesystem load by relative paths ([ac156db](https://github.com/mistic/static-fs/commit/ac156db))
* return added files to a volume upon creation ([be6348c](https://github.com/mistic/static-fs/commit/be6348c))
* return added files to a volume upon creation ([d664df3](https://github.com/mistic/static-fs/commit/d664df3))
* return added files to a volume upon creation ([b9879d2](https://github.com/mistic/static-fs/commit/b9879d2))
* support for child process ([7f1a187](https://github.com/mistic/static-fs/commit/7f1a187))
* order in the returned list of paths for the content added ([#38](https://github.com/mistic/static-fs/issues/38)) ([f0c4ad7](https://github.com/mistic/static-fs/commit/f0c4ad7))
* return added files and base folders on generation ([#26](https://github.com/mistic/static-fs/issues/26)) ([4a290eb](https://github.com/mistic/static-fs/commit/4a290eb))
