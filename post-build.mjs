import { postBuildScript, publishScript, getInfoFromChangelog, publishGhRelease } from 'js2me-exports-post-build-script';
import path from 'path';

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
        if (publishOutput?.publishedGitTag) {
          const { whatChangesText } = getInfoFromChangelog(
            nextVersion,
            path.resolve(targetPackageJson.locationDir, '../CHANGELOG.md'),
            targetPackageJson.repositoryUrl
          );

          publishGhRelease({
            authToken: process.env.GITHUB_TOKEN,
            body: whatChangesText,
            owner: targetPackageJson.ghRepoData.user,
            repo: targetPackageJson.ghRepoData.packageName,
            version: nextVersion,
          })
            .then((r) =>{
              console.info('published new gh release',r)
            })
            .catch((err) =>{
              console.error('failed to publish new gh release', err);
              process.exit(1);
            })
        }
      }
    }
  }
});

