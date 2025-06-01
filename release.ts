/// <reference types="zx/globals" />

import process from 'node:process';
import packageJson from "./package.json" with { type: "json" };
import { readFile, writeFile } from "node:fs/promises";

const version = `v${packageJson.version}`;

async function updateMetainfo(file: string) {
    const date = new Date();
    const release = `
    <release version="${version}" date="${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}">
      <url type="details">https://gitlab.com/garuda-linux/firedragon12/builder/-/releases/${version}</url>
      <description />
    </release>`;

    await writeFile(file, (await readFile(file, 'utf-8')).replace('<releases>', `<releases>${release}`), 'utf-8');
}

if (await $`git tag -l ${version}`.text()) {
    echo(`Tag ${version} already exists. Aborting...`);
    process.exit(1);
}

await updateMetainfo('assets/org.garudalinux.firedragon.metainfo.xml');

await $`git-cliff -u -t ${version} -p CHANGELOG.md`;

await $`git add package.json CHANGELOG.md assets/org.garudalinux.firedragon.metainfo.xml`;
await $`git commit -m 'release: '${version}`;
await $`git tag -m ${version} ${version}`
