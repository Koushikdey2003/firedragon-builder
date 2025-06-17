# Development documentation

## Installing dependencies

To install deno dependencies, run the following command:

``` shell
deno install --allow-scripts
```

## Start dev server & browser

Run the following command to start the dev server and browser:

``` shell
deno task dev
```

## Releases

To create a new release update the version and if required the runtime version in `package.json` and run the following command:

```shell
deno task release
```

Now push the newly created commit and tag to have CI publish a new release.

## `deno task make`

The make task is used by the CI to build FireDragon but can also be invoked locally, see [simple build method](./build/simple.md) and [make options and targets](./make.md).
