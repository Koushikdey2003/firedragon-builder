/// <reference types="zx/globals" />

import process from 'node:process';
import packageJson from "./package.json" with { type: "json" };

const version = `v${packageJson.version}-${packageJson.runtime}`;

if (await $`git tag -l ${version}`.text()) {
    echo(`Tag ${version} already exists. Aborting...`);
    process.exit(1);
}

await $`git-cliff -u -t ${version} -p CHANGELOG.md`;

await $`git add package.json CHANGELOG.md`;
await $`git commit -m 'release: '${version}`;
await $`git tag -m ${version} ${version}`
