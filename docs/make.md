# make

``` shell
deno task make [...options] [...targets]
```

## Options

| Option                                 | Description                                                                                                                |
|----------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| `--enable-bootstrap`                   | Enable automatic installation of dependencies                                                                              |
| `--enable-update`                      | Build with update URL and package update MAR                                                                               |
| `--dist-dir=DIST_DIR`                  | Set custom dist dir where finished packages will be moved                                                                  |
| `--edition=EDITION`                    | Set edition to build. Accepted values: `dr460nized`, `catppuccin`                                                          |
| `--target=TARGET`                      | Set target to build. Accepted values: `linux-x64`, `linux-arm64`, `win32-x64`, `win32-arm64`, `darwin-x64`, `darwin-arm64` |
| `--with-buildid2=BUILDID2`             | Set BuildID2 file to use during build. Run `deno task build --write-buildid2` to create `_dist/buildid2`.                  |
| `--with-moz-build-date=MOZ_BUILD_DATE` | Read `MOZ_BUILD_DATE` variable to use during build from file. Defaults to current date in `%Y%m%d%H%M%S` format.           |
| `--with-dist=DIST`                     | Set prebuilt dist files to use during build. Run `deno task build --release-build-before` to create `_dist/noraneko`.      |
| `--with-mozconfig`                     | Add additional mozconfig to append to FireDragon defaults.                                                                 |

## Targets

| Target      | Description             |
|-------------|-------------------------|
| `source`    | Build source archive   |
| `build`     | Build release build     |
| `build-dev` | Build development build |
| `appimage`  | Build AppImage          |
