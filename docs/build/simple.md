# Simple build method

## Install dependencies

First, ensure that the following dependencies are installed:

- curl
- [Deno](https://deno.com/)
- file *(For AppImage build only)*
- git
- msitools *(For windows build only)*
- Node.js
- 7-Zip (Ubuntu: p7zip-full) *(For windows build only)*
- patch
- Python3 with pip
- ripgrep
- rsync
- rust *(For cross-compilation, rustup is also needed)*
- tar
- zip *(For windows build only)*
- zstd

Alternatively you can use [distrobox](https://github.com/89luca89/distrobox) to create yourself a build environment using the `registry.gitlab.com/garuda-linux/firedragon/firedragon12/make:latest` image.

## Clone this repository

First clone this repository and enter the cloned directory:

``` shell
git clone https://gitlab.com/garuda-linux/firedragon/firedragon12.git
cd firedragon12
```

## Install deno dependencies

To install all deno dependencies run:

``` shell
deno install --allow-scripts --frozen
```

## Running build

There are two available editions to build:

- [Dr560nized](#dr460nized) (default)
- [Catppuccin](#catppuccin)

The build is run using the `make` task for more information [click here](../make.md).

### Dr460nized

To build the dr460nized edition run the following command:

``` shell
deno task make --enable-bootstrap --edition=dr460nized build
```

The output will be in: `.dist/`

## Package AppImage *(optional, only available on linux)*

To package the finished build as an AppImage, run the following command:

``` shell
deno task make appimage
```

The output will also be in `.dist/`
