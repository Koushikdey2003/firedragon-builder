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
        boolean: ['enable-bootstrap'],
        string: ['dist-dir', 'edition', 'target'],
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
    runtime: string;
    tmpDir: string;
    distDir: string;
    edition: (typeof EDITIONS)[keyof typeof EDITIONS];
    basename: string;
    target: (typeof TARGETS)[keyof typeof TARGETS];
    enableBootstrap: boolean;
}

async function getFloorpRuntime({ runtime, tmpDir }: Config): Promise<string> {
    const response = await fetch(`https://api.github.com/repos/Floorp-Projects/Floorp-runtime/releases/${runtime}`);
    if (!response.ok) {
        throw `Invalid runtime release: ${runtime}`;
    }

    const release: {
        tag_name: string,
        tarball_url: string,
    } = await response.json() as any;

    const tarball = `${tmpDir}/floorp-runtime-${release.tag_name}.tar.gz`;

    if (!await exists(tarball)) {
        await $`curl -L ${release.tarball_url} -o ${tarball}`
    }

    return tarball;
}

async function prepareSource(config: Config, dir: string, patches: 'packaging' | 'dev' = 'packaging'): Promise<void> {
    const { version, edition } = config;

    // Extract floorp runtime and inject this repo
    const runtimeTarball = await getFloorpRuntime(config);
    await $`mkdir ${dir}`;
    await $`tar -xf ${runtimeTarball} --strip-components=1 -C ${dir}`;
    await $`rsync -a --delete --exclude=_dist --exclude=.dist --exclude=.git --exclude=.idea --exclude=node_modules --exclude=*.tar.* ./ ${dir}/floorp/`;

    // Copy branding
    await $`cp -r gecko/branding/* ${dir}/browser/branding/`;

    // Apply edition in default mozconfig
    await $`sed -i -e 's/@BRANDING@/${edition.branding}/' -e 's/@THEME@/${edition.theme}/' ${dir}/floorp/gecko/mozconfig`;

    // Set display version
    await $`echo ${version} > ${dir}/browser/config/version_display.txt`;

    // Apply patches
    await applyPatches(dir, `patches/{shared,${patches}}/**/*.patch`);
}

async function source(config: Config) {
    const { tmpDir, distDir, basename } = config;

    await prepareSource(config, `${tmpDir}/${basename}`);

    await $`tar --zstd -cf ${distDir}/${basename}.source.tar.zst --exclude=.git -C ${tmpDir} ${basename}`;
}

async function build(config: Config) {
    const { tmpDir, distDir, basename, target, enableBootstrap } = config;

    const buildBasename = `${basename}.${target.buildSuffix}`;
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
    await $`cat ${buildDir}/floorp/gecko/mozconfig{,.${target.mozconfig}} > ${buildDir}/mozconfig`;

    // Run release build before
    await $`cd ${buildDir}/floorp && NODE_ENV=production deno task build --release-build-before`;

    if (enableBootstrap) {
        await $`cd ${buildDir} && ./mach --no-interactive bootstrap --application-choice browser`;
        const rustup = (await which('rustup', { nothrow: true })) ?? `${os.homedir()}/.cargo/bin/rustup`;
        await $`${rustup} target add ${target.rustTarget}`;
    }

    // Run configure
    await $`${buildDir}/mach configure ${enableBootstrap ? '--enable-bootstrap' : '--disable-bootstrap'} --target=${target.target}`;

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

    // Remove pingsender
    await $`rm -f ${objDistDir}/firedragon/pingsender*`;

    // Package output archive
    if (target.buildOutputFormat === 'tar.zst') {
        await $`tar --zstd -cf ${distDir}/${buildBasename}.tar.zst -C ${objDistDir} firedragon`;
    } else if (target.buildOutputFormat === 'exe') {
        const zipPath = `${objDistDir}/${buildBasename}.zip`;
        await $`cd ${objDistDir} && zip -r ${zipPath} firedragon`;
        await $`${buildDir}/mach repackage installer -o ${distDir}/${buildBasename}.exe --package-name firedragon --package ${zipPath} --tag ${buildDir}/browser/installer/windows/app.tag --setupexe ${buildDir}/obj-artifact-build-output/browser/installer/windows/instgen/setup.exe --sfx-stub ${buildDir}/other-licenses/7zstub/firefox/7zSD.Win32.sfx`;
    } else {
        throw `Invalid build output format ${target.buildOutputFormat}, must be on of [tar.zst, exe].`;
    }
}

async function appimage(config: Config) {
    const { tmpDir, distDir, basename, target } = config;

    if (!target.appimageSuffix) {
        throw `Target ${target.target} does not support appimage build.`;
    }

    const appimageBasename = `${basename}.${target.appimageSuffix}`;
    const appimageDir = `${tmpDir}/${appimageBasename}`;

    const buildTarball = `${distDir}/${basename}.${target.buildSuffix}.tar.zst`;
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
    const { tmpDir, distDir, basename, target, enableBootstrap } = config;

    const buildDevBasename = `${basename}.${target.buildDevSuffix}`
    const buildDevDir = `${tmpDir}/${buildDevBasename}`;

    await prepareSource(config, buildDevDir, 'dev');

    // Combine mozconfig
    await $`cat ${buildDevDir}/floorp/gecko/mozconfig{,.${target.mozconfig}} > ${buildDevDir}/mozconfig`;

    if (enableBootstrap) {
        await $`cd ${buildDevDir} && ./mach --no-interactive bootstrap --application-choice browser`;
        const rustup = (await which('rustup', { nothrow: true })) ?? `${os.homedir()}/.cargo/bin/rustup`;
        await $`${rustup} target add ${target.rustTarget}`;
    }

    // Run configure
    await $`${buildDevDir}/mach configure ${enableBootstrap ? '--enable-bootstrap' : '--disable-bootstrap'} --target=${target.target} --enable-chrome-format=flat --enable-firedragon-debug`;

    // Run build
    await $`${buildDevDir}/mach build`;

    // https://www.spinics.net/lists/git/msg391750.html
    const objDistDir = `${buildDevDir}/obj-artifact-build-output/dist`;
    await $`rsync -aL ${objDistDir}/bin/ ${objDistDir}/tmp__bin/`;
    await $`rm -rf ${objDistDir}/bin`;
    await $`mv ${objDistDir}/tmp__bin ${objDistDir}/bin`;

    // Run package
    await $`${buildDevDir}/mach package`;

    // Remove pingsender
    await $`rm -f ${objDistDir}/firedragon/pingsender*`;

    // Package output archive
    if (target.buildOutputFormat === 'tar.zst') {
        await $`tar --zstd -cf ${distDir}/${buildDevBasename}.tar.zst -C ${objDistDir} firedragon`;
    } else if (target.buildOutputFormat === 'zip') {
        await $`cd ${objDistDir} && zip -r ${distDir}/${buildDevBasename}.zip firedragon`;
    } else {
        throw `Invalid build output format ${target.buildOutputFormat}, must be on of [tar.zst, zip].`;
    }
}

async function darwinUniversal(config: Config, outSuffix: string, x64Suffix: string, aarch64Suffix: string) {
    const { tmpDir, distDir, basename, enableBootstrap } = config;

    const x64Tarball = `${distDir}/${basename}.${x64Suffix}.tar.zst`;
    if (!await exists(x64Tarball)) {
        throw `x64-Tarball ${x64Tarball} not found.`;
    }

    const aarch64Tarball = `${distDir}/${basename}.${aarch64Suffix}.tar.zst`;
    if (!await exists(aarch64Tarball)) {
        throw `aarch64-Tarball ${aarch64Tarball} not found.`;
    }

    const sourceTarball = `${distDir}/${basename}.source.tar.zst`;
    if (!await exists(sourceTarball)) {
        await source(config);
    }

    const outBasename = `${basename}.${outSuffix}`;
    const outDir = `${tmpDir}/${outBasename}`;

    // Extract source
    await $`mkdir ${outDir}`;
    await $`tar -xf ${sourceTarball} --strip-components=1 -C ${outDir}`;

    if (enableBootstrap) {
        await $`cd ${outDir} && ./mach --no-interactive bootstrap --application-choice browser`;
        await $`echo -e 'ac_add_options --enable-bootstrap' > mozconfig`;
    }

    // Extract x64 tarball
    await $`mkdir -p ${outDir}/obj-x86_64-apple-darwin/dist`;
    await $`tar -xf ${x64Tarball} -C ${outDir}/obj-x86_64-apple-darwin/dist`;

    // Extract aarch64 tarball
    await $`mkdir -p ${outDir}/obj-aarch64-apple-darwin/dist`;
    await $`tar -xf ${aarch64Tarball} -C ${outDir}/obj-aarch64-apple-darwin/dist`;

    // Integration
    await $`${outDir}/mach python ${outDir}/toolkit/mozapps/installer/unify.py ${outDir}/obj-x86_64-apple-darwin/dist/firedragon/FireDragon.app ${outDir}/obj-aarch64-apple-darwin/dist/firedragon/FireDragon.app`

    // Create DMG
    await $`${outDir}/mach python -m mozbuild.action.make_dmg ${outDir}/obj-x86_64-apple-darwin/dist/floorp ${distDir}/${outBasename}.dmg`;
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
const TARGETS = {
    'linux-x64': {
        mozconfig: 'linux-x64',
        target: 'x86_64-pc-linux-gnu',
        rustTarget: 'x86_64-unknown-linux-gnu',
        buildSuffix: 'linux-x64',
        buildOutputFormat: 'tar.zst',
        buildDevOutputFormat: 'tar.zst',
        appimageSuffix: 'appimage-x64',
        buildDevSuffix: 'linux-x64.dev',
    },
    'linux-aarch64': {
        mozconfig: 'linux-aarch64',
        target: 'aarch64-linux-gnu',
        rustTarget: 'aarch64-unknown-linux-gnu',
        buildSuffix: 'linux-aarch64',
        buildOutputFormat: 'tar.zst',
        buildDevOutputFormat: 'tar.zst',
        appimageSuffix: 'appimage-aarch64',
        buildDevSuffix: 'linux-aarch64.dev',
    },
    'windows-x64': {
        mozconfig: 'windows-x64',
        target: 'x86_64-pc-windows-msvc',
        rustTarget: 'x86_64-pc-windows-msvc',
        buildSuffix: 'windows-x64',
        buildOutputFormat: 'exe',
        buildDevOutputFormat: 'zip',
        appimageSuffix: null,
        buildDevSuffix: 'windows-x64.dev',
    },
    'darwin-x64': {
        mozconfig: 'darwin-x64',
        target: 'x86_64-apple-darwin',
        rustTarget: 'x86_64-apple-darwin',
        buildSuffix: 'darwin-x64',
        buildOutputFormat: 'tar.zst',
        buildDevOutputFormat: 'tar.zst',
        appimageSuffix: null,
        buildDevSuffix: 'darwin-x64.dev',
    },
    'darwin-aarch64': {
        mozconfig: 'darwin-aarch64',
        target: 'aarch64-apple-darwin',
        rustTarget: 'aarch64-apple-darwin',
        buildSuffix: 'darwin-aarch64',
        buildOutputFormat: 'tar.zst',
        buildDevOutputFormat: 'tar.zst',
        appimageSuffix: null,
        buildDevSuffix: 'darwin-aarch64.dev',
    },
};

let tmpDir;
try {
    tmpDir = tmpdir();
    echo(`Using temporary directory: ${tmpDir}`);

    let argv = parseArgv(process.argv.slice(4));
    while (true) {
        const distDir = argv['dist-dir'] ?? '.dist';
        if (!await exists(distDir)) {
            await $`mkdir -p ${distDir}`;
        }

        const edition = EDITIONS[(argv['edition'] ?? 'dr640nized') as keyof typeof EDITIONS];
        if (!edition) {
            throw `Unsupported edition ${argv['edition']}, must be one of [${Object.keys(EDITIONS).join(', ')}].`;
        }

        const target = TARGETS[(argv['target'] ?? `${process.platform}-${process.arch}`) as keyof typeof TARGETS];
        if (!target){
            throw `Unsupported target ${argv['target']}, must be one of [${Object.keys(TARGETS).join(', ')}].`;
        }

        const { version } = packageJson;
        const basename = `${edition.basename}-v${version}`;

        const config: Config = {
            version,
            runtime: argv.runtime ?? packageJson.runtime,
            tmpDir,
            distDir,
            edition,
            basename,
            target,
            enableBootstrap: argv['enable-bootstrap'] ?? false,
        };

        for (const command of argv._) {
            switch (command) {
                case 'source':
                    await source(config);
                    break;
                case 'build':
                    await build(config);
                    break;
                case 'build-dev':
                    await buildDev(config);
                    break;
                case 'appimage':
                    await appimage(config);
                    break;
                case 'darwin-universal':
                    await darwinUniversal(config, 'darwin-universal', TARGETS['darwin-x64'].buildSuffix, TARGETS['darwin-aarch64'].buildSuffix);
                    break;
                case 'darwin-universal-dev':
                    await darwinUniversal(config, 'darwin-universal.dev', TARGETS['darwin-x64'].buildDevSuffix, TARGETS['darwin-aarch64'].buildDevSuffix);
                    break;
                default:
                    throw `Unsupported command ${command}, must be one of [source, build, appimage, darwin-universal, build-dev, darwin-universal-dev]`;
            }
        }

        if (!argv['--']?.length) {
            break;
        }
        argv = parseArgv(argv['--']);
    }
} finally {
    //await $`rm -rf ${tmpDir}`;
}
