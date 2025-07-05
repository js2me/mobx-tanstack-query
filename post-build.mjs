import { postBuildScript, publishScript, getInfoFromChangelog } from 'js2me-exports-post-build-script';

postBuildScript({
  buildDir: 'dist',
  rootDir: '.',
  srcDirName: 'src',
  filesToCopy: ['LICENSE', 'README.md', 'assets'],
  updateVersion: process.env.PUBLISH_VERSION,
  onDone: (versionsDiff, targetPackageJson, { $ }) => {
    if (process.env.PUBLISH) {
      if (!process.env.CI) {
        $('pnpm test');
        $('pnpm changeset version');
      }

      const nextVersion = versionsDiff?.next ?? targetPackageJson.data.version;

      const publishOutput = publishScript({
        gitTagFormat: '<tag>',
        nextVersion: nextVersion,
        packageManager: 'pnpm',
        commitAllCurrentChanges: true,
        createTag: true,
        safe: true,
        onAlreadyPublishedThisVersion: () => {
          console.warn(`${nextVersion} already published`);
        },
        githubRepoLink: 'https://github.com/js2me/mobx-tanstack-query',
        cleanupCommand: 'pnpm clean',
        targetPackageJson
      });

      if (process.env.CI) {
        if (publishOutput.publishedGitTag) {
          const { whatChangesText } = getInfoFromChangelog(nextVersion, `${targetPackageJson.locationDir}/CHANGELOG.md`);
          process.env.PUBLISHED_VERSION_RELEASE_NOTES = whatChangesText;
        }
      }
    }
  }
});

