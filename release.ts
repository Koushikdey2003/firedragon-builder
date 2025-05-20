/// <reference types="zx/globals" />

import process from 'node:process';
import packageJson from "./package.json" with { type: "json" };

const argv = minimist(process.argv.slice(4), {
    string: ['v', 'r'],
})

const current = packageJson.version.split('-');

const version = argv.v ?? current[0];
const release = argv.r ?? (argv.v ? 1 : current[1]);

const full = `${version}-${release}`;
const tag = `v${full}`;

if (await $`git tag -l ${tag}`.text()) {
    echo(`Tag ${tag} already exists. Aborting...`);
    process.exit(1);
}

await $`jq '.version = '${JSON.stringify(full)} package.json | sponge package.json`;

await $`git-cliff -u -t ${full} -p CHANGELOG.md`;

await $`git add package.json CHANGELOG.md`;
await $`git commit -m 'release: '${tag}`;
await $`git tag -m ${tag} ${tag}`
