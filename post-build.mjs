import { postBuildScript } from 'js2me-exports-post-build-script';

postBuildScript({
  buildDir: 'dist',
  rootDir: '.',
  srcDirName: 'src',
  filesToCopy: ['LICENSE', 'README.md'],
  onPackageVersionChanged: (next, prev, { $ }) => {
    if (process.env.PUBLISH) {
      $('git add .');
      $(`git commit -m "bump: update to version ${next} from ${prev}"`);
      $('cd dist && pnpm publish && cd ..');
      $('git push');
      $(`git tag -a v${next} -m v${prev}`);
      $(`git push origin v${next}`);
      $('npm run clean');
    }
  }
});
