import { postBuildScript, publishScript } from 'js2me-exports-post-build-script';

postBuildScript({
  buildDir: 'dist',
  rootDir: '.',
  srcDirName: 'src',
  filesToCopy: ['LICENSE', 'README.md', 'assets'],
  updateVersion: process.env.PUBLISH_VERSION,
  onDone: (versionsDiff, _, packageJson, { targetPackageJson }) => {
    if (process.env.PUBLISH) {
      publishScript({
        nextVersion: versionsDiff?.next ?? packageJson.version,
        currVersion: versionsDiff?.current,
        publishCommand: 'pnpm publish',
        commitAllCurrentChanges: true,
        createTag: true,
        githubRepoLink: 'https://github.com/js2me/mobx-tanstack-query',
        cleanupCommand: 'pnpm clean',
        targetPackageJson
      })
    }
  }
});

