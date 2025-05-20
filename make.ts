/// <reference types="zx/globals" />

import { access } from 'node:fs/promises';
import packageJson from './package.json' with { type: 'json' };

function exists(path: string): Promise<boolean> {
    return access(path).then(() => true).catch(() => false);
}

async function applyPatches(target: string, ...patches: string[]): Promise<void> {
    for (const patch of await glob(patches)) {
        await $`patch -Nsp1 -d ${quote(target)} -i ${quote(path.resolve(patch))}`;
    }
}

function parseArgv(argv: string[]) {
    return minimist(argv, {
        string: ['dist-dir', 'edition', 'arch'],
        boolean: ['with-sccache'],
        unknown(arg) {
            if (arg.startsWith('-')) {
                throw `Unknown arguments: ${arg}`
            }
            return true;
        },
        '--': true,
    });
}

interface BuildInfo {
    version: string;
    distDir: string;
    edition: (typeof EDITIONS)[keyof typeof EDITIONS];
    basename: string
    arch: (typeof ARCHITECTURES)[keyof typeof ARCHITECTURES];
}

async function source(buildInfo: BuildInfo) {
    const { distDir, edition, basename } = buildInfo;

    const sourceDir = `${tmpDir}/${basename}`;

    const runtimeRelease: {
        tag_name: string,
        tarball_url: string,
    } = await (await fetch('https://api.github.com/repos/Floorp-Projects/Floorp-12-runtime/releases/latest')).json() as any;
    const runtimeTarball = `${tmpDir}/floorp-runtime-${runtimeRelease.tag_name}.tar.gz`;

    if (!await exists(runtimeTarball)) {
        await $`curl -L ${quote(runtimeRelease.tarball_url)} -o ${quote(runtimeTarball)}`
    }

    // Extract floorp runtime and inject this repo
    await $`mkdir ${quote(sourceDir)}`;
    await $`tar -xf ${quote(runtimeTarball)} --strip-components=1 -C ${quote(sourceDir)}`;
    await $`rsync -a --delete --exclude=_dist --exclude=.dist --exclude=.git --exclude=.idea --exclude=node_modules --exclude=*.tar.xz ./ ${quote(sourceDir)}/floorp/`;

    // Copy branding
    await $`cp -r gecko/branding/* ${quote(sourceDir)}/browser/branding/`;

    // Apply edition in default mozconfig
    await $`sed -i -e 's/@BRANDING@/${edition.branding}/' -e 's/@THEME@/${edition.theme}/' ${quote(sourceDir)}/floorp/gecko/mozconfig`;

    // Set display version
    await $`echo ${quote(version)} > ${quote(sourceDir)}/browser/config/version_display.txt`;

    // Apply patches
    await applyPatches(sourceDir, 'patches/**/*.patch');

    await $`tar --zstd -cf ${quote(distDir)}/${basename}.source.tar.zst --exclude=.git -C ${quote(tmpDir)} ${basename}`;
}

async function build(buildInfo: BuildInfo) {
    const { distDir, basename, arch } = buildInfo;

    const buildBasename = `${basename}.${arch.suffix}`;
    const buildDir = `${tmpDir}/${buildBasename}`

    if (!await exists(`${distDir}/${basename}.source.tar.zst`)) {
        await source(buildInfo);
    }

    await $`mkdir ${quote(buildDir)}`;
    await $`tar -xf ${quote(distDir)}/${basename}.source.tar.zst --strip-components=1 -C ${quote(buildDir)}`;

    // Install deno dependencies
    await $`cd ${quote(buildDir)}/floorp && deno install --allow-scripts`;

    // Call --write-version only to generate buildid2 file
    await $`cd ${quote(buildDir)}/floorp && deno task build --write-version`;

    // Combine mozconfig
    await $`cat ${quote(buildDir)}/floorp/gecko/mozconfig ${quote(buildDir)}/floorp/gecko/mozconfig.${arch.mozconfig} > ${quote(buildDir)}/mozconfig`;

    // Run release build before
    await $`cd ${quote(buildDir)}/floorp && NODE_ENV=production deno task build --release-build-before`;

    // Run configure
    await $`${quote(buildDir)}/mach configure`;

    // Run build
    await $`${quote(buildDir)}/mach build`;

    // Run release build after
    await $`cd ${quote(buildDir)}/floorp && deno task build --release-build-after`;

    // https://www.spinics.net/lists/git/msg391750.html
    const objDistDir = `${buildDir}/obj-artifact-build-output/dist`;
    await $`rsync -aL ${quote(objDistDir)}/bin/ ${quote(objDistDir)}/tmp__bin/`;
    await $`rm -rf ${quote(objDistDir)}/bin`;
    await $`mv ${quote(objDistDir)}/tmp__bin ${quote(objDistDir)}/bin`;

    // Apply patches
    await applyPatches(`${objDistDir}/bin`, 'scripts/git-patches/patches/*.patch');

    // Run package
    await $`${quote(buildDir)}/mach package`;

    // Package output archive
    await $`tar --zstd -cf ${quote(distDir)}/${buildBasename}.tar.zst --exclude=pingsender -C ${quote(objDistDir)} firedragon`;
}

const EDITIONS = {
    dr640nized: {
        branding: 'firedragon',
        theme: 'sweet-dark',
        basename: 'firedragon',
    },
    catppuccin: {
        branding: 'firedragon-catppuccin',
        theme: 'catppuccin-mocha-mauve',
        basename: 'firedragon-catppuccin',
    },
};
const ARCHITECTURES = {
    'linux-x86_64': {
        mozconfig: 'linux-x86_64',
        suffix: 'linux-x86_64',
    },
};
const { version } = packageJson;

const tmpDir = tmpdir();

try {
    let argv = parseArgv(process.argv.slice(4));

    while (true) {
        const distDir = argv['dist-dir'] ?? '.dist';
        if (!await exists(distDir)) {
            await $`mkdir -p ${quote(distDir)}`;
        }

        const edition = EDITIONS[(argv['edition'] ?? 'dr640nized') as keyof typeof EDITIONS];
        const arch = ARCHITECTURES[(argv['arch'] ?? 'linux-x86_64') as keyof typeof ARCHITECTURES];

        if (!edition) {
            throw `Unsupported edition ${argv['edition']}, must be one of [${Object.keys(EDITIONS).join(', ')}].`;
        }
        if (!arch) {
            throw `Unsupported architecture ${argv['arch']}, must be one of [${Object.keys(ARCHITECTURES).join(', ')}].`;
        }

        const basename = `${edition.basename}-${version}`;

        const buildInfo: BuildInfo = {
            version,
            distDir,
            edition,
            basename,
            arch,
        }

        for (const command of argv._) {
            switch (command) {
                case "source":
                    await source(buildInfo);

                    break;
                case "build":
                    await build(buildInfo);

                    break;
                default:
                    throw `Unsupported command ${command}, must be one of [source, build]`;
            }
        }

        if (!argv['--']?.length) {
            break;
        }
        argv = parseArgv(argv['--']);
    }
} finally {
    await $`rm -rf ${quote(tmpDir)}`;
}
