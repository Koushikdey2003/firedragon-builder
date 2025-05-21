/// <reference types="zx/globals" />

import { access } from 'node:fs/promises';
import process from 'node:process';
import packageJson from './package.json' with { type: 'json' };

function exists(path: string): Promise<boolean> {
    return access(path).then(() => true).catch(() => false);
}

async function applyPatches(target: string, ...patches: string[]): Promise<void> {
    for (const patch of await glob(patches)) {
        await $`patch -Nsp1 -d ${target} -i ${path.resolve(patch)}`;
    }
}

function parseArgv(argv: string[]) {
    return minimist(argv, {
        string: ['dist-dir', 'edition', 'arch'],
        unknown(arg) {
            if (arg.startsWith('-')) {
                throw `Unknown arguments: ${arg}`
            }
            return true;
        },
        '--': true,
    });
}

interface Config {
    version: string;
    tmpDir: string;
    distDir: string;
    edition: (typeof EDITIONS)[keyof typeof EDITIONS];
    basename: string
    arch: (typeof ARCHITECTURES)[keyof typeof ARCHITECTURES];
}

async function getFloorpRuntime({ tmpDir }: Config): Promise<string> {
    const runtimeRelease: {
        tag_name: string,
        tarball_url: string,
    } = await (await fetch('https://api.github.com/repos/Floorp-Projects/Floorp-12-runtime/releases/latest')).json() as any;
    const runtimeTarball = `${tmpDir}/floorp-runtime-${runtimeRelease.tag_name}.tar.gz`;

    if (!await exists(runtimeTarball)) {
        await $`curl -L ${runtimeRelease.tarball_url} -o ${runtimeTarball}`
    }

    return runtimeTarball;
}

async function source(config: Config) {
    const { tmpDir, distDir, edition, basename } = config;

    const sourceDir = `${tmpDir}/${basename}`;

    // Extract floorp runtime and inject this repo
    const runtimeTarball = await getFloorpRuntime(config);
    await $`mkdir ${sourceDir}`;
    await $`tar -xf ${runtimeTarball} --strip-components=1 -C ${sourceDir}`;
    await $`rsync -a --delete --exclude=_dist --exclude=.dist --exclude=.git --exclude=.idea --exclude=node_modules --exclude=*.tar.xz ./ ${sourceDir}/floorp/`;

    // Copy branding
    await $`cp -r gecko/branding/* ${sourceDir}/browser/branding/`;

    // Apply edition in default mozconfig
    await $`sed -i -e 's/@BRANDING@/${edition.branding}/' -e 's/@THEME@/${edition.theme}/' ${sourceDir}/floorp/gecko/mozconfig`;

    // Set display version
    await $`echo ${version} > ${sourceDir}/browser/config/version_display.txt`;

    // Apply patches
    await applyPatches(sourceDir, 'patches/{shared,packaging}/**/*.patch');

    await $`tar --zstd -cf ${distDir}/${basename}.source.tar.zst --exclude=.git -C ${tmpDir} ${basename}`;
}

async function build(config: Config) {
    const { tmpDir, distDir, basename, arch } = config;

    const buildBasename = `${basename}.${arch.buildSuffix}`;
    const buildDir = `${tmpDir}/${buildBasename}`

    const sourceTarball = `${distDir}/${basename}.source.tar.zst`;
    if (!await exists(sourceTarball)) {
        await source(config);
    }

    // Extract source
    await $`mkdir ${buildDir}`;
    await $`tar -xf ${sourceTarball} --strip-components=1 -C ${buildDir}`;

    // Install deno dependencies
    await $`cd ${buildDir}/floorp && deno install --allow-scripts --frozen`;

    // Call --write-version only to generate buildid2 file
    await $`cd ${buildDir}/floorp && deno task build --write-version`;

    // Combine mozconfig
    await $`cat ${buildDir}/floorp/gecko/mozconfig ${buildDir}/floorp/gecko/mozconfig.${arch.mozconfig} > ${buildDir}/mozconfig`;

    // Run release build before
    await $`cd ${buildDir}/floorp && NODE_ENV=production deno task build --release-build-before`;

    // Run configure
    await $`${buildDir}/mach configure`;

    // Run build
    await $`${buildDir}/mach build`;

    // Run release build after
    await $`cd ${buildDir}/floorp && deno task build --release-build-after`;

    // https://www.spinics.net/lists/git/msg391750.html
    const objDistDir = `${buildDir}/obj-artifact-build-output/dist`;
    await $`rsync -aL ${objDistDir}/bin/ ${objDistDir}/tmp__bin/`;
    await $`rm -rf ${objDistDir}/bin`;
    await $`mv ${objDistDir}/tmp__bin ${objDistDir}/bin`;

    // Apply patches
    await applyPatches(`${objDistDir}/bin`, 'scripts/git-patches/patches/*.patch');

    // Run package
    await $`${buildDir}/mach package`;

    // Package output archive
    await $`tar --zstd -cf ${distDir}/${buildBasename}.tar.zst --exclude=pingsender -C ${objDistDir} firedragon`;
}

async function appimage(config: Config) {
    const { tmpDir, distDir, basename, arch } = config;

    const appimageBasename = `${basename}.${arch.appimageSuffix}`;
    const appimageDir = `${tmpDir}/${appimageBasename}`;

    const buildTarball = `${distDir}/${basename}.${arch.buildSuffix}.tar.zst`;
    if (!await exists(buildTarball)) {
        await build(config);
    }

    await $`mkdir ${appimageDir}`;
    await $`tar -xf ${buildTarball} --strip-components=1 -C ${appimageDir}`;

    await $`sed 's#/usr/lib/firedragon/firedragon#firedragon#' assets/firedragon.desktop > ${appimageDir}/firedragon.desktop`;
    await $`cp ${appimageDir}/browser/chrome/icons/default/default128.png ${appimageDir}/firedragon.png`;

    await $`cp assets/AppRun ${appimageDir}/AppRun`;
    await $`chmod a+x ${appimageDir}/AppRun`;

    await $`curl -L https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage -o ${tmpDir}/appimagetool-x86_64.AppImage`;
    await $`chmod a+x ${tmpDir}/appimagetool-x86_64.AppImage`;

    await $`${tmpDir}/appimagetool-x86_64.AppImage ${appimageDir} ${distDir}/${appimageBasename}.AppImage`;
}

async function buildDev(config: Config) {
    const { tmpDir, distDir, edition, basename, arch } = config;

    const buildDevBasename = `${basename}.${arch.buildDevSuffix}`
    const buildDevDir = `${tmpDir}/${buildDevBasename}`;

    // Extract floorp runtime and inject this repo
    const runtimeTarball = await getFloorpRuntime(config);
    await $`mkdir ${buildDevDir}`;
    await $`tar -xf ${runtimeTarball} --strip-components=1 -C ${buildDevDir}`;
    await $`rsync -a --delete --exclude=_dist --exclude=.dist --exclude=.git --exclude=.idea --exclude=node_modules --exclude=*.tar.xz ./ ${buildDevDir}/floorp/`;

    // Copy branding
    await $`cp -r gecko/branding/* ${buildDevDir}/browser/branding/`;

    // Apply edition in default mozconfig
    await $`sed -i -e 's/@BRANDING@/${edition.branding}/' -e 's/@THEME@/${edition.theme}/' ${buildDevDir}/floorp/gecko/mozconfig`;

    // Set display version
    await $`echo ${version} > ${buildDevDir}/browser/config/version_display.txt`;

    // Apply patches
    await applyPatches(buildDevDir, 'patches/{shared,dev}/**/*.patch', `${buildDevDir}/.github/patches/dev/**/*.patch`);

    // Combine mozconfig
    await $`cat ${buildDevDir}/floorp/gecko/mozconfig ${buildDevDir}/floorp/gecko/mozconfig.${arch.mozconfig} > ${buildDevDir}/mozconfig`;

    // Run configure
    await $`${buildDevDir}/mach configure --enable-chrome-format=flat`;

    // Run build
    await $`${buildDevDir}/mach build`;

    // https://www.spinics.net/lists/git/msg391750.html
    const objDistDir = `${buildDevDir}/obj-artifact-build-output/dist`;
    await $`rsync -aL ${objDistDir}/bin/ ${objDistDir}/tmp__bin/`;
    await $`rm -rf ${objDistDir}/bin`;
    await $`mv ${objDistDir}/tmp__bin ${objDistDir}/bin`;

    // Run package
    await $`${buildDevDir}/mach package`;

    // Package output archive
    await $`tar --zstd -cf ${distDir}/${buildDevBasename}.tar.zst --exclude=pingsender -C ${objDistDir} firedragon`;
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
        buildSuffix: 'linux-x86_64',
        appimageSuffix: 'appimage-x86_64',
        buildDevSuffix: 'linux-x86_64.dev',
    },
};
const { version } = packageJson;

const tmpDir = tmpdir();
echo(`Using temporary directory: ${tmpDir}`);

try {
    let argv = parseArgv(process.argv.slice(4));

    while (true) {
        const distDir = argv['dist-dir'] ?? '.dist';
        if (!await exists(distDir)) {
            await $`mkdir -p ${distDir}`;
        }

        const edition = EDITIONS[(argv['edition'] ?? 'dr640nized') as keyof typeof EDITIONS];
        const arch = ARCHITECTURES[(argv['arch'] ?? 'linux-x86_64') as keyof typeof ARCHITECTURES];

        if (!edition) {
            throw `Unsupported edition ${argv['edition']}, must be one of [${Object.keys(EDITIONS).join(', ')}].`;
        }
        if (!arch) {
            throw `Unsupported architecture ${argv['arch']}, must be one of [${Object.keys(ARCHITECTURES).join(', ')}].`;
        }

        const basename = `${edition.basename}-v${version}`;

        const config: Config = {
            version,
            tmpDir,
            distDir,
            edition,
            basename,
            arch,
        }

        for (const command of argv._) {
            switch (command) {
                case "source":
                    await source(config);
                    break;
                case "build":
                    await build(config);
                    break;
                case "build-dev":
                    await buildDev(config);
                    break;
                case "appimage":
                    await appimage(config);
                    break;
                default:
                    throw `Unsupported command ${command}, must be one of [source, build, appimage, build-dev]`;
            }
        }

        if (!argv['--']?.length) {
            break;
        }
        argv = parseArgv(argv['--']);
    }
} finally {
    await $`rm -rf ${tmpDir}`;
}
