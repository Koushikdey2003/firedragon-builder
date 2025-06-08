/// <reference types="zx/globals" />

import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { json2xml } from "npm:xml-js";
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
        boolean: ['enable-bootstrap', 'enable-update'],
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

async function combineMozconfigs(buildDir: string, ...mozconfigs: string[]) {
    for (const mozconfig of mozconfigs) {
        await $`echo -e '. "$topsrcdir"/'${mozconfig} >> ${buildDir}/mozconfig`;
    }
}

async function acAddOptions(buildDir: string, ...options: string[]) {
    for (const option of options) {
        await $`echo -e 'ac_add_options '${option} >> ${buildDir}/mozconfig`;
    }
}

interface Config {
    version: string;
    runtime: string;
    tmpDir: string;
    distDir: string;
    appName: string;
    appBasename: string;
    sourceBasename: string;
    edition: (typeof EDITIONS)[keyof typeof EDITIONS];
    basename: string;
    target: (typeof TARGETS)[keyof typeof TARGETS];
    enableBootstrap: boolean;
    enableUpdate: boolean;
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
    const { version } = config;

    // Extract floorp runtime and inject this repo
    const runtimeTarball = await getFloorpRuntime(config);
    await $`mkdir ${dir}`;
    await $`tar -xf ${runtimeTarball} --strip-components=1 -C ${dir}`;
    await $`rsync -a --delete --exclude=_dist --exclude=.dist --exclude=.git --exclude=.idea --exclude=node_modules --exclude=*.tar.* ./ ${dir}/floorp/`;

    // Copy branding
    await $`cp -r gecko/branding/* ${dir}/browser/branding/`;

    // Set display version
    await $`echo -e ${version} > ${dir}/browser/config/version_display.txt`;

    await applyPatches(dir, `patches/**/*.patch`);
}

async function extractSource(config: Config, buildDir: string): Promise<void> {
    const { distDir, sourceBasename } = config;

    const sourceTarball = `${distDir}/${sourceBasename}.tar.zst`;
    if (!await exists(sourceTarball)) {
        await source(config);
    }

    // Extract source
    await $`mkdir ${buildDir}`;
    await $`tar -xf ${sourceTarball} --strip-components=1 -C ${buildDir}`;
}

async function prepareBuild(config: Config, buildDir: string) {
    const { edition, target, withBuildID2 } = config;

    // Install deno dependencies
    await $`cd ${buildDir}/floorp && deno install --allow-scripts --frozen`;

    // Ensure buildid2 exists
    if (withBuildID2) {
        await $`mkdir -p ${buildDir}/floorp/_dist`;
        await $`cat ${withBuildID2} > ${buildDir}/floorp/_dist/buildid2`;
    } else if (!await exists(`${buildDir}/floorp/_dist/buildid2`)) {
        await $`cd ${buildDir}/floorp && deno task build --write-buildid2`;
    }

    // Combine mozconfigs
    await combineMozconfigs(buildDir, edition.mozconfig, target.mozconfig);
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
        await acAddOptions(buildDir, '--enable-bootstrap');
    } else {
        await acAddOptions(buildDir, '--disable-bootstrap');
    }

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
    const { distDir, appName, appBasename, edition } = config;

    const { objDistDir, objDistBinDir } = getCommonBuildDirs(config, buildDir);

    // Remove references to build directory
    for (const file of await $`rg -Fl ${buildDir} ${objDistBinDir}`.nothrow().lines()) {
        await $`sed -i 's#${buildDir}##g' ${file}`;
    }

    // Run package
    await $`${buildDir}/mach package`;

    // Remove pingsender
    for (const pingsender of await glob(`${objDistDir}/${appName}{,/${appBasename}.app/Contents/MacOS}/pingsender{,.exe}`)) {
        await $`rm -f ${pingsender}`;
    }

    // Package output archive
    if (outputFormat === 'tar.zst') {
        await $`tar --zstd -cf ${distDir}/${buildBasename}.tar.zst -C ${objDistDir} ${appName}`;
    } else if (outputFormat === 'exe') {
        const zipPath = `${objDistDir}/${buildBasename}.zip`;
        await $`cd ${objDistDir} && zip -r ${zipPath} ${appName}`;
        await $`${buildDir}/mach repackage installer -o ${distDir}/${buildBasename}.exe --package-name ${appName} --package ${zipPath} --tag ${buildDir}/browser/installer/windows/app.tag --setupexe ${buildDir}/obj-artifact-build-output/browser/installer/windows/instgen/setup.exe --sfx-stub ${buildDir}/other-licenses/7zstub/firefox/7zSD.Win32.sfx`;
    } else if (outputFormat === 'zip') {
        await $`cd ${objDistDir} && zip -r ${resolve(distDir)}/${buildBasename}.zip ${appName}`;
    } else if (outputFormat === 'dmg') {
        await $`${buildDir}/mach python -m mozbuild.action.make_dmg --dsstore ${buildDir}/browser/branding/${edition.branding}/dsstore --background ${buildDir}/browser/branding/${edition.branding}/background.png --icon ${buildDir}/browser/branding/${edition.branding}/disk.icns --volume-name ${appBasename} ${objDistDir}/${appName} ${distDir}/${buildBasename}.dmg`;
    } else {
        throw `Invalid build output format ${outputFormat}, must be on of [tar.zst, exe, zip].`;
    }
}

function getUpdateUrl(config: Config, ext: 'mar' | 'update.xml'): string {
    const { edition, target } = config;

    return `https://gitlab.com/garuda-linux/firedragon/firedragon12/-/releases/permalink/latest/downloads/${edition.basename}-${target.buildSuffix}.${ext}`;
}

async function createUpdate(config: Config, buildBasename: string, buildDir: string) {
    const { version, distDir, target } = config;

    const { objDistDir, objDistBinDir } = getCommonBuildDirs(config, buildDir);

    await $`MAR=${objDistDir}/host/bin/mar MOZ_PRODUCT_VERSION=${version} MAR_CHANNEL_ID=release ${buildDir}/tools/update-packaging/make_full_update.sh ${distDir}/${buildBasename}.mar ${objDistDir}/${target.updatePath}`;

    const [
        appVersion,
        buildID,
        buildID2,
        hashValue,
        size,
    ] = await Promise.all([
        (async () => (await $`cat ${buildDir}/browser/config/version.txt`).lines()[0])(),
        (async () => (await $`awk -F '=' '/BuildID/ {print $2}' ${objDistBinDir}/application.ini`).lines()[0])(),
        (async () => (await $`cat ${objDistBinDir}/browser/buildid2`).lines()[0])(),
        (async () => (await $`sha512sum ${distDir}/${buildBasename}.mar | cut -c 1-128`).lines()[0])(),
        (async () => (await $`stat -c '%s' ${distDir}/${buildBasename}.mar`).lines()[0])(),
    ]);

    const update = {
        _declaration: {
            _attributes: {
                version: "1.0",
                encoding: "UTF-8",
            },
        },
        updates: {
            update: {
                _attributes: {
                    type: 'minor',
                    displayVersion: version,
                    appVersion: appVersion,
                    platformVersion: appVersion,
                    buildID: buildID,
                    appVersion2: version,
                    buildID2: buildID2,
                    detailsURL: `https://gitlab.com/garuda-linux/firedragon/firedragon12/-/releases/v${version}`,
                },
                patch: [
                    {
                        _attributes: {
                            type: "complete",
                            URL: getUpdateUrl(config, 'mar'),
                            hashFunction: 'sha512',
                            hashValue: hashValue,
                            size: size,
                        },
                    },
                ],
            },
        },
    };

    await $`echo -e ${json2xml(JSON.stringify(update), { "compact": true, spaces: 4 })} > ${distDir}/${buildBasename}.update.xml`;
}

async function source(config: Config) {
    const { tmpDir, distDir, sourceBasename } = config;

    await prepareSource(config, `${tmpDir}/${sourceBasename}`);

    await $`tar --zstd -cf ${distDir}/${sourceBasename}.tar.zst -C ${tmpDir} ${sourceBasename}`;
}

async function build(config: Config) {
    const { tmpDir, basename, target, enableUpdate, withDist } = config;

    const buildBasename = `${basename}-${target.buildSuffix}`;
    const buildDir = `${tmpDir}/${buildBasename}`

    await extractSource(config, buildDir);

    await prepareBuild(config, buildDir);

    // Use provided dist or run release build before
    if (withDist) {
        await $`cp -r ${withDist}/noraneko ${buildDir}/floorp/_dist/noraneko`;
    } else {
        await $`cd ${buildDir}/floorp && NODE_ENV=production deno task build --release-build-before`;
    }

    // Set noraneko dist
    await acAddOptions(buildDir, '--with-noraneko-dist=floorp/_dist/noraneko');

    if (enableUpdate) {
        await acAddOptions(buildDir, `--with-firedragon-update=${getUpdateUrl(config, 'update.xml')}`);
    } else {
        await acAddOptions(buildDir, '--disable-updater');
    }

    await doBuild(config, buildDir);

    // Run release build after
    await $`cd ${buildDir}/floorp && deno task build --release-build-after`;

    await cloneObjDistBin(config, buildDir);

    await applyPatches(`${getCommonBuildDirs(config, buildDir).objDistBinDir}`, 'scripts/git-patches/patches/*.patch');

    await packageBuild(config, target.buildOutputFormat, buildBasename, buildDir);

    if (enableUpdate) {
        await createUpdate(config, buildBasename, buildDir);
    }
}

async function appimage(config: Config) {
    const { tmpDir, distDir, appName, basename, target } = config;

    if (!target.appimageSuffix) {
        throw `Target does not support appimage build.`;
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
    await $`sed 's#/usr/lib/${appName}/${appName}#${appName}#' assets/${appName}.desktop > ${appimageDir}/${appName}.desktop`;
    await $`cp ${appimageDir}/browser/chrome/icons/default/default128.png ${appimageDir}/${appName}.png`;

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

    await extractSource(config, buildDevDir);

    await prepareBuild(config, buildDevDir);

    await acAddOptions(buildDevDir, '--enable-firedragon-debug', '--enable-chrome-format=flat');

    await doBuild(config, buildDevDir);

    await cloneObjDistBin(config, buildDevDir);

    await packageBuild(config, target.buildDevOutputFormat, buildDevBasename, buildDevDir);
}

const APP_NAME = 'firedragon';
const APP_BASENAME = 'FireDragon';
const EDITIONS = {
    dr640nized: {
        mozconfig: 'floorp/gecko/mozconfigs/edition/firedragon-dr460nized.mozconfig',
        branding: 'firedragon',
        basename: APP_NAME,
    },
    catppuccin: {
        mozconfig: 'floorp/gecko/mozconfigs/edition/firedragon-catppuccin.mozconfig',
        branding: 'firedragon-catppuccin',
        basename: `${APP_NAME}-catppuccin`,
    },
};
const TARGETS = {
    'linux-x64': {
        mozconfig: 'floorp/gecko/mozconfigs/arch/linux-x64.mozconfig',
        objDistBinPath: 'bin',
        buildSuffix: 'linux-x64',
        buildOutputFormat: 'tar.zst',
        buildDevOutputFormat: 'tar.zst',
        appimageSuffix: 'appimage-x64',
        updatePath: APP_NAME,
    },
    'linux-arm64': {
        mozconfig: 'floorp/gecko/mozconfigs/arch/linux-arm64.mozconfig',
        objDistBinPath: 'bin',
        buildSuffix: 'linux-arm64',
        buildOutputFormat: 'tar.zst',
        buildDevOutputFormat: 'tar.zst',
        appimageSuffix: 'appimage-arm64',
        updatePath: APP_NAME,
    },
    'win32-x64': {
        mozconfig: 'floorp/gecko/mozconfigs/arch/win32-x64.mozconfig',
        objDistBinPath: 'bin',
        buildSuffix: 'win32-x64',
        buildOutputFormat: 'exe',
        buildDevOutputFormat: 'zip',
        appimageSuffix: null,
        updatePath: APP_NAME,
    },
    'win32-arm64': {
        mozconfig: 'floorp/gecko/mozconfigs/arch/win32-arm64.mozconfig',
        objDistBinPath: 'bin',
        buildSuffix: 'win32-arm64',
        buildOutputFormat: 'exe',
        buildDevOutputFormat: 'zip',
        appimageSuffix: null,
        updatePath: APP_NAME,
    },
    'darwin-x64': {
        mozconfig: 'floorp/gecko/mozconfigs/arch/darwin-x64.mozconfig',
        objDistBinPath: `${APP_BASENAME}.app/Contents/Resources`,
        buildSuffix: 'darwin-x64',
        buildOutputFormat: 'dmg',
        buildDevOutputFormat: 'dmg',
        appimageSuffix: null,
        updatePath: `${APP_NAME}/${APP_BASENAME}.app`,
    },
    'darwin-arm64': {
        mozconfig: 'floorp/gecko/mozconfigs/arch/darwin-arm64.mozconfig',
        objDistBinPath: `${APP_BASENAME}.app/Contents/Resources`,
        buildSuffix: 'darwin-arm64',
        buildOutputFormat: 'dmg',
        buildDevOutputFormat: 'dmg',
        appimageSuffix: null,
        updatePath: `${APP_NAME}/${APP_BASENAME}.app`,
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
        const sourceBasename = `${APP_NAME}-source-v${version}`;
        const basename = `${edition.basename}-v${version}`;

        const config: Config = {
            version,
            runtime: argv.runtime ?? packageJson.runtime,
            tmpDir,
            distDir,
            appName: APP_NAME,
            appBasename: APP_BASENAME,
            sourceBasename,
            edition,
            basename,
            target,
            enableBootstrap: argv['enable-bootstrap'] ?? false,
            enableUpdate: argv['enable-update'] ?? false,
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
