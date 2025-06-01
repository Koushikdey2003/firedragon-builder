/// <reference types="zx/globals" />

import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import packageJson from './package.json' with { type: 'json' };

async function exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
}

async function applyPatches(target: string, ...patches: string[]): Promise<void> {
    for (const patch of await glob(patches)) {
        await $`patch -Nsp1 -d ${target} -i ${resolve(patch)}`;
    }
}

function parseArgv(argv: string[]) {
    return minimist(argv, {
        boolean: ['enable-bootstrap'],
        string: ['dist-dir', 'edition', 'target', 'with-buildid2', 'with-moz-build-date', 'with-dist'],
        unknown(arg) {
            if (arg.startsWith('-')) {
                throw `Unknown arguments: ${arg}`
            }
            return true;
        },
        '--': true,
    });
}

async function acAddOptions(buildDir: string, ...options: string[]) {
    for (const option of options) {
        await $`echo -e 'ac_add_options ${option}' >> ${buildDir}/mozconfig`;
    }
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
    withMozBuildDate: string | null;
    withBuildID2: string | null;
    withDist: string | null;
}

async function getFloorpRuntime(config: Config): Promise<string> {
    const { runtime, tmpDir } = config;

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

async function prepareSource(config: Config, dir: string): Promise<void> {
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

    await applyPatches(dir, `patches/**/*.patch`);
}

async function prepareBuild(config: Config, buildDir: string) {
    const { target, withBuildID2 } = config;

    // Install deno dependencies
    await $`cd ${buildDir}/floorp && deno install --allow-scripts --frozen`;

    // Ensure buildid2 exists
    if (withBuildID2) {
        await $`mkdir -p ${buildDir}/floorp/_dist`;
        await $`cat ${withBuildID2} > ${buildDir}/floorp/_dist/buildid2`;
    } else if (!await exists(`${buildDir}/floorp/_dist/buildid2`)) {
        await $`cd ${buildDir}/floorp && deno task build --write-version`;
    }

    // Combine mozconfig
    await $`cat ${buildDir}/floorp/gecko/mozconfig{,.${target.mozconfig}} > ${buildDir}/mozconfig`;
}

async function doBuild(config: Config, buildDir: string) {
    const { target, enableBootstrap, withMozBuildDate } = config;

    // Potentially set MOZ_BUILD_DATE
    if (withMozBuildDate) {
        const moz_build_date = (await Deno.readTextFile(withMozBuildDate)).trim();
        Deno.env.set('MOZ_BUILD_DATE', moz_build_date);
    }

    // Potentially run bootstrap
    if (enableBootstrap) {
        await $`cd ${buildDir} && ./mach --no-interactive bootstrap --application-choice browser`;
        const rustup = (await which('rustup', { nothrow: true })) ?? `${os.homedir()}/.cargo/bin/rustup`;
        await $`${rustup} target add ${target.rustTarget}`;
        await acAddOptions(buildDir, '--enable-bootstrap');
    } else {
        await acAddOptions(buildDir, '--disable-bootstrap');
    }

    // Set target
    await acAddOptions(buildDir, `--target=${target.target}`);

    // Run configure
    await $`${buildDir}/mach configure`;

    // Run build
    await $`${buildDir}/mach build`;
}

function getCommonBuildDirs(config: Config, buildDir: string): { objDistDir: string, objDistBinDir: string } {
    const { target } = config;

    const objDistDir = `${buildDir}/obj-artifact-build-output/dist`;
    const objDistBinDir = `${objDistDir}/${target.objDistBinPath}`;

    return {
        objDistDir,
        objDistBinDir,
    };
}

async function cloneObjDistBin(config: Config, buildDir: string) {
    const { objDistBinDir } = getCommonBuildDirs(config, buildDir);

    // Resolve symlinks (https://www.spinics.net/lists/git/msg391750.html)
    const objDistBinTmpDir = tmpdir();
    await $`rsync -aL ${objDistBinDir}/ ${objDistBinTmpDir}/`;
    await $`rm -rf ${objDistBinDir}`;
    await $`mv ${objDistBinTmpDir} ${objDistBinDir}`;
}

async function packageBuild(config: Config, outputFormat: string, buildBasename: string, buildDir: string) {
    const { distDir, edition } = config;

    const { objDistDir, objDistBinDir } = getCommonBuildDirs(config, buildDir);

    // Remove references to build directory
    for (const file of await $`rg -Fl ${buildDir} ${objDistBinDir} || true`.lines()) {
        await $`sed -i 's#${buildDir}##g' ${file}`;
    }

    // Run package
    await $`${buildDir}/mach package`;

    // Remove pingsender
    for (const pingsender of await glob(`${objDistDir}/firedragon{,/FireDragon.app/Contents/MacOS}/pingsender{,.exe}`)) {
        await $`rm -f ${pingsender}`;
    }

    // Package output archive
    if (outputFormat === 'tar.zst') {
        await $`tar --zstd -cf ${distDir}/${buildBasename}.tar.zst -C ${objDistDir} firedragon`;
    } else if (outputFormat === 'exe') {
        const zipPath = `${objDistDir}/${buildBasename}.zip`;
        await $`cd ${objDistDir} && zip -r ${zipPath} firedragon`;
        await $`${buildDir}/mach repackage installer -o ${distDir}/${buildBasename}.exe --package-name firedragon --package ${zipPath} --tag ${buildDir}/browser/installer/windows/app.tag --setupexe ${buildDir}/obj-artifact-build-output/browser/installer/windows/instgen/setup.exe --sfx-stub ${buildDir}/other-licenses/7zstub/firefox/7zSD.Win32.sfx`;
    } else if (outputFormat === 'zip') {
        await $`cd ${objDistDir} && zip -r ${resolve(distDir)}/${buildBasename}.zip firedragon`;
    } else if (outputFormat === 'dmg') {
        await $`${buildDir}/mach python -m mozbuild.action.make_dmg --dsstore ${buildDir}/browser/branding/${edition.branding}/dsstore --background ${buildDir}/browser/branding/${edition.branding}/background.png --icon ${buildDir}/browser/branding/${edition.branding}/disk.icns --volume-name FireDragon ${objDistDir}/firedragon ${distDir}/${buildBasename}.dmg`;
    } else {
        throw `Invalid build output format ${outputFormat}, must be on of [tar.zst, exe, zip].`;
    }
}

async function source(config: Config) {
    const { tmpDir, distDir, basename } = config;

    await prepareSource(config, `${tmpDir}/${basename}`);

    await $`tar --zstd -cf ${distDir}/${basename}.tar.zst --exclude=.git -C ${tmpDir} ${basename}`;
}

async function build(config: Config) {
    const { tmpDir, distDir, basename, target, withDist } = config;

    const buildBasename = `${basename}-${target.buildSuffix}`;
    const buildDir = `${tmpDir}/${buildBasename}`

    const sourceTarball = `${distDir}/${basename}.tar.zst`;
    if (!await exists(sourceTarball)) {
        await source(config);
    }

    // Extract source
    await $`mkdir ${buildDir}`;
    await $`tar -xf ${sourceTarball} --strip-components=1 -C ${buildDir}`;

    await prepareBuild(config, buildDir);

    // Use provided dist or run release build before
    if (withDist) {
        await $`cp -r ${withDist}/noraneko ${buildDir}/floorp/_dist/noraneko`;
    } else {
        await $`cd ${buildDir}/floorp && NODE_ENV=production deno task build --release-build-before`;
    }

    // Set noraneko dist
    await acAddOptions(buildDir, '--with-noraneko-dist=floorp/_dist/noraneko');

    await doBuild(config, buildDir);

    // Run release build after
    await $`cd ${buildDir}/floorp && deno task build --release-build-after`;

    await cloneObjDistBin(config, buildDir);

    await applyPatches(`${getCommonBuildDirs(config, buildDir).objDistBinDir}`, 'scripts/git-patches/patches/*.patch');

    await packageBuild(config, target.buildOutputFormat, buildBasename, buildDir);
}

async function appimage(config: Config) {
    const { tmpDir, distDir, basename, target } = config;

    if (!target.appimageSuffix) {
        throw `Target ${target.target} does not support appimage build.`;
    }

    const appimageBasename = `${basename}-${target.appimageSuffix}`;
    const appimageDir = `${tmpDir}/${appimageBasename}`;

    const buildTarball = `${distDir}/${basename}-${target.buildSuffix}.tar.zst`;
    if (!await exists(buildTarball)) {
        await build(config);
    }

    // Extract binary tarball
    await $`mkdir ${appimageDir}`;
    await $`tar -xf ${buildTarball} --strip-components=1 -C ${appimageDir}`;

    // Copy desktop and logo
    await $`sed 's#/usr/lib/firedragon/firedragon#firedragon#' assets/firedragon.desktop > ${appimageDir}/firedragon.desktop`;
    await $`cp ${appimageDir}/browser/chrome/icons/default/default128.png ${appimageDir}/firedragon.png`;

    // Copy AppRun and make executable
    await $`cp assets/AppRun ${appimageDir}/AppRun`;
    await $`chmod a+x ${appimageDir}/AppRun`;

    // Download appimagetool and make executable
    await $`curl -L https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage -o ${tmpDir}/appimagetool-x86_64.AppImage`;
    await $`chmod a+x ${tmpDir}/appimagetool-x86_64.AppImage`;

    // Make AppImage
    await $`${tmpDir}/appimagetool-x86_64.AppImage ${appimageDir} ${distDir}/${appimageBasename}.AppImage`;
}

async function buildDev(config: Config) {
    const { tmpDir, basename, target } = config;

    const buildDevBasename = `${basename}-${target.buildSuffix}-dev`
    const buildDevDir = `${tmpDir}/${buildDevBasename}`;

    await prepareSource(config, buildDevDir);

    await prepareBuild(config, buildDevDir);

    await acAddOptions(buildDevDir, '--enable-firedragon-debug', '--enable-chrome-format=flat');

    await doBuild(config, buildDevDir);

    await cloneObjDistBin(config, buildDevDir);

    await packageBuild(config, target.buildDevOutputFormat, buildDevBasename, buildDevDir);
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
        objDistBinPath: 'bin',
        buildSuffix: 'linux-x64',
        buildOutputFormat: 'tar.zst',
        buildDevOutputFormat: 'tar.zst',
        appimageSuffix: 'appimage-x64',
    },
    'linux-arm64': {
        mozconfig: 'linux-arm64',
        target: 'aarch64-linux-gnu',
        rustTarget: 'aarch64-unknown-linux-gnu',
        objDistBinPath: 'bin',
        buildSuffix: 'linux-arm64',
        buildOutputFormat: 'tar.zst',
        buildDevOutputFormat: 'tar.zst',
        appimageSuffix: 'appimage-arm64',
    },
    'win32-x64': {
        mozconfig: 'win32-x64',
        target: 'x86_64-pc-windows-msvc',
        rustTarget: 'x86_64-pc-windows-msvc',
        objDistBinPath: 'bin',
        buildSuffix: 'win32-x64',
        buildOutputFormat: 'exe',
        buildDevOutputFormat: 'zip',
        appimageSuffix: null,
    },
    'win32-arm64': {
        mozconfig: 'win32-arm64',
        target: 'aarch64-pc-windows-msvc',
        rustTarget: 'aarch64-pc-windows-msvc',
        objDistBinPath: 'bin',
        buildSuffix: 'win32-arm64',
        buildOutputFormat: 'exe',
        buildDevOutputFormat: 'zip',
        appimageSuffix: null,
    },
    'darwin-x64': {
        mozconfig: 'darwin-x64',
        target: 'x86_64-apple-darwin',
        rustTarget: 'x86_64-apple-darwin',
        objDistBinPath: 'FireDragon.app/Contents/Resources',
        buildSuffix: 'darwin-x64',
        buildOutputFormat: 'dmg',
        buildDevOutputFormat: 'dmg',
        appimageSuffix: null,
    },
    'darwin-arm64': {
        mozconfig: 'darwin-arm64',
        target: 'aarch64-apple-darwin',
        rustTarget: 'aarch64-apple-darwin',
        objDistBinPath: 'FireDragon.app/Contents/Resources',
        buildSuffix: 'darwin-arm64',
        buildOutputFormat: 'dmg',
        buildDevOutputFormat: 'dmg',
        appimageSuffix: null,
    },
};

let tmpDir;
try {
    tmpDir = tmpdir();
    echo(`Using temporary directory: ${tmpDir}`);

    await $`mkdir -p ${tmpDir}`;

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
            withMozBuildDate: argv['with-moz-build-date'] ?? null,
            withBuildID2: argv['with-buildid2'] ?? null,
            withDist: argv['with-dist'] ?? null,
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
