# Advanced build method

***WARNING: For advanced users only!***

This method is most often only required for specific circumstances (e.g. packaging for a distribution). Almost everything can be done using the [simple method](./simple.md) by just [customizing the options for the make task](../make.md).

## Install dependencies

First, ensure that the following dependencies are installed:

- [Deno](https://deno.com/)
- msitools *(For windows build only)*
- Node.js
- 7-Zip (Ubuntu: p7zip-full) *(For windows build only)*
- patch
- Python3 with pip
- ripgrep
- rsync
- rust
- tar
- zip *(For windows build only)*
- zstd

## Download source

[Download](https://gitlab.com/garuda-linux/firedragon/firedragon12/-/releases/permalink/latest/downloads/firedragon-source.tar.zst) the source from the latest release, extract it and navigate into it:

``` shell
tar -xf firedragon-source-vX.X.X.tar.zst
cd firedragon-source-vX.X.X
```

## Before build

Before building, run the following commands:

``` shell
cd firedragon # Navigate into the firedragon directory
deno install --allow-scripts --frozen
deno task build --release-build-before
cd .. # Return to the parent directory
```

## Setup build config

Create your `mozconfig` file using the `mozconfig` files in `gecko/mozconfigs/` as a base with the following addition:

``` shell
ac_add_options --with-noraneko-dist=firedragon/_dist/noraneko
```

Depending on whether you want to skip the next step of bootstrapping the build environment, you have to add one of the following configs:

``` shell
# To enable build environment bootstrapping:
ac_add_options --enable-bootstrap

# To disable build environment bootstrapping:
ac_add_options --disable-bootstrap
```

## Bootstrap build environment *(optional)*

This is optional, you can either install all build dependencies manually or have the build system install them for you:

``` shell
./mach --no-interactive bootstrap --application-choice browser
```

If you want to skip this step, you will likely have to add additional build configuration, as well as manually install required dependencies.

## Run the actual build

To run the actual build, run the following command:

``` shell
./mach build
```

## After build

After building run the following commands:

``` shell
cd firedragon # Navigate into the firedragon directory
deno task build --release-build-after
cd .. # Return to the parent directory
```

## Installing or packaging finished build

From here you can either install or package the finished build:

### Installing build

To install the build run the following command:

``` shell
./mach install
```

If you want to specify a specific `DESTDIR` to install the build into set it as an environment variable:

``` shell
DESTDIR=/path/to/install/dir ./mach/install
```

### Packaging build

To package the build run the following command:

``` shell
./mach package
```

The result will be in either the `obj-artifact-build-output/` or the `obj-artifact-build-output/install/sea/` (for Windows installers) directory.

---

## Further information

For more information, you can look at the [ArchLinux PKGBUILD](https://gitlab.com/garuda-linux/pkgbuilds/-/blob/main/firedragon/PKGBUILD?ref_type=heads) to see how it uses this method to package FireDragon.
