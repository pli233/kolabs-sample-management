const { execFileSync } = require('child_process')
const path = require('path')

// Deep ad-hoc sign the packed bundle. electron-builder with identity:null leaves
// the Python sidecar (and other nested binaries) unsealed, which macOS reports as
// "damaged and can't be opened". Re-signing the whole bundle ad-hoc makes the
// signature valid, so Gatekeeper shows the normal "unidentified developer" prompt
// (Open Anyway) instead of refusing to launch.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const app = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  )
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], {
    stdio: 'inherit',
  })
}
