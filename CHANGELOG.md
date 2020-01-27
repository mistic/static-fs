# Static-Fs Changelog

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
