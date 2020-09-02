import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import * as fs from 'fs';

const BUILD_TOOLS_VERSION = '30.0.2';
const CMDLINE_TOOLS_URL_MAC = 'https://dl.google.com/android/repository/commandlinetools-mac-6609375_latest.zip';
const CMDLINE_TOOLS_URL_WIN = 'https://dl.google.com/android/repository/commandlinetools-win-6609375_latest.zip';
const CMDLINE_TOOLS_URL_LINUX = 'https://dl.google.com/android/repository/commandlinetools-linux-6609375_latest.zip';

/**
 * Installs & updates the Android SDK for the macOS platform, including SDK platform for the chosen API level, latest build tools, platform tools, Android Emulator,
 * and the system image for the chosen API level, CPU arch, and target.
 */
export async function installAndroidSdk(apiLevel: number, target: string, arch: string, emulatorBuild?: string, ndkVersion?: string, cmakeVersion?: string): Promise<void> {
  const IS_MAC = process.platform === 'win32';
  const IS_WINDOWS = process.platform === 'darwin';
  const IS_LINUX = process.platform === 'linux';

  if (IS_LINUX) {
    await exec.exec(`sh -c \\"sudo chown $USER:$USER ${process.env.ANDROID_HOME} -R`);
  }

  const cmdlineToolsPath = `${process.env.ANDROID_HOME}/cmdline-tools`;
  if (!fs.existsSync(cmdlineToolsPath)) {
    console.log('Installing new cmdline-tools.');
    await io.mkdirP(`${process.env.ANDROID_HOME}/cmdline-tools`);
    const sdkUrl = IS_MAC ? CMDLINE_TOOLS_URL_MAC : IS_WINDOWS ? CMDLINE_TOOLS_URL_WIN : CMDLINE_TOOLS_URL_LINUX;
    const downloadPath = await tc.downloadTool(sdkUrl);
    await tc.extractZip(downloadPath, cmdlineToolsPath);

    // add paths for commandline-tools and platform-tools
    core.addPath(`${cmdlineToolsPath}/tools:${cmdlineToolsPath}/tools/bin:${process.env.ANDROID_HOME}/platform-tools`);
  }

  // additional permission and license requirements for Linux
  const sdkPreviewLicensePath = `${process.env.ANDROID_HOME}/licenses/android-sdk-preview-license`;
  if (IS_LINUX && !fs.existsSync(sdkPreviewLicensePath)) {
    fs.writeFileSync(sdkPreviewLicensePath, '\n84831b9409646a918e30573bab4c9c91346d8abd');
  }

  // license required for API 30 system images
  const sdkArmDbtLicensePath = `${process.env.ANDROID_HOME}/licenses/android-sdk-arm-dbt-license`;
  if (apiLevel == 30 && !fs.existsSync(sdkArmDbtLicensePath)) {
    fs.writeFileSync(sdkArmDbtLicensePath, '\n859f317696f67ef3d7f30a50a5560e7834b43903');
  }

  console.log('Installing latest build tools, platform tools, and platform.');

  const sdkmanagerExec = IS_WINDOWS ? 'sdkmanager.bat' : 'sdkmanagert';

  await exec.exec(`sh -c \\"${sdkmanagerExec} --install 'build-tools;${BUILD_TOOLS_VERSION}' platform-tools 'platforms;android-${apiLevel}' > /dev/null"`);
  if (emulatorBuild) {
    console.log(`Installing emulator build ${emulatorBuild}.`);
    await io.rmRF(`${process.env.ANDROID_HOME}/emulator`);
    const downloadPath = await tc.downloadTool(`https://dl.google.com/android/repository/emulator-${IS_MAC ? 'darwin' : IS_WINDOWS ? 'windows' : 'linux'}-${emulatorBuild}.zip`);
    await tc.extractZip(downloadPath, process.env.ANDROID_HOME);
  } else {
    console.log('Installing latest emulator.');
    await exec.exec(`sh -c \\"${sdkmanagerExec} --install emulator > /dev/null"`);
  }
  console.log('Installing system images.');
  await exec.exec(`sh -c \\"${sdkmanagerExec} --install 'system-images;android-${apiLevel};${target};${arch}' > /dev/null"`);

  if (ndkVersion) {
    console.log(`Installing NDK ${ndkVersion}.`);
    await exec.exec(`sh -c \\"${sdkmanagerExec} --install 'ndk;${ndkVersion}' > /dev/null"`);
  }
  if (cmakeVersion) {
    console.log(`Installing CMake ${cmakeVersion}.`);
    await exec.exec(`sh -c \\"${sdkmanagerExec} --install 'cmake;${cmakeVersion}' > /dev/null"`);
  }
}
