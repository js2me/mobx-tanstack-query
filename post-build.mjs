import { postBuildScript, publishScript } from 'js2me-exports-post-build-script';

postBuildScript({
  buildDir: 'dist',
  rootDir: '.',
  srcDirName: 'src',
  filesToCopy: ['LICENSE', 'README.md'],
  updateVersion: process.env.PUBLISH_VERSION,
  onPackageVersionChanged: (nextVersion, currVersion) => {
    if (process.env.PUBLISH) {
      publishScript({
        nextVersion,
        currVersion,
        publishCommand: 'pnpm publish',
        commitAllCurrentChanges: true,
        createTag: true,
        githubRepoLink: 'https://github.com/js2me/mobx-tanstack-query',
        cleanupCommand: 'pnpm clean',
      })
    }
  }
});

