# FireDragon 12

This repository contains the source of the upcoming FireDragon version 12 based on the new Floorp 12 build system.

## Build commands

### Prerequisites

Install [deno](https://docs.deno.com/).

Install dependencies:

``` shell
deno install --allow-scripts --frozen
```

### Build source archive

``` shell
deno task make source
```

Output can be found in: `.dist`

### Build linux x86_64 archive

``` shell
deno task make build
```

Output can be found in: `.dist/`

## Editions

FireDragon is available in 2 editions:

- Dr460nized (default)
- Catppuccin

To select the edition use the `--edition` argument, e.g.:

``` shell
deno task make --edition=catppuccin source
deno task make --edition=catppuccin build
```
