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

There are two available editions to build, which can be selected using the `--edition` option:

- `dr460nized` (default)
- `catppuccin`

You can also select a specific target to build, if you want to cross-compile, by setting the `--target` option:

- `linux-x64`: Linux x64 (Rust toolchain: `x86_64-unknown-linux-gnu`)
- `linux-arm64`: Linux ARM64 (Rust toolchain: `aarch64-unknown-linux-gnu`)
- `win32-x64`: Windows x64 (Rust toolchain: `x86_64-pc-windows-msvc`)
- `win32-arm64`: Windows ARM64 (Rust toolchain: `aarch64-pc-windows-msvc`)
- `darwin-x64`: MacOS x64 (Rust toolchain: `x86_64-apple-darwin`)
- `darwin-arm64`: MacOS ARM64 (Rust toolchain: `aarch64-apple-darwin`)

If the `--target` option is omitted it will auto-detect based on your current system.
Additionally, if you cross-compile, you will have to install the corresponding rust toolchain:

``` shell
rustup toolchain install TOOLCHAIN
```

Finally, to run the build, you then run the following command with the correct options:

``` shell
deno task make --enable-bootstrap --edition=EDITION --target=TARGET build
```

The output will be in: `.dist/`

## Package AppImage *(optional, only available on linux)*

To package the finished build as an AppImage, run the following command:

``` shell
deno task make appimage
```

The output will also be in `.dist/`
