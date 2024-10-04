/* eslint-disable @typescript-eslint/no-unused-vars */
import { execSync } from 'child_process';
import fs, { lstatSync } from 'fs';
import path from 'path';

//#region утилиты
const $ = (cmd) => execSync(cmd, { stdio: 'inherit' });
const scanDir = (dir) => fs.readdirSync(dir);
const readFile = (file) => fs.readFileSync(file);
const writeFile = (file, content) => fs.writeFileSync(file, content);
//#endregion

$(`cp -r LICENSE dist`);

const lookupExportsMap = (targetPath, exportsMap) => {
  exportsMap = exportsMap || {};

  const pathstat = lstatSync(targetPath);

  if (pathstat.isDirectory()) {
    const subdirs = scanDir(targetPath);

    subdirs.forEach((subdir) => {
      lookupExportsMap(`${targetPath}/${subdir}`, exportsMap);
    });
  } else {
    const ext = path.extname(targetPath);

    const fixedPath = targetPath.replace(ext, '').replace('src/', '');

    if (
      fixedPath.endsWith('.store') ||
      fixedPath.endsWith('.store.types') ||
      fixedPath.endsWith('.types') ||
      fixedPath.endsWith('.impl')
    ) {
      return;
    }

    if (ext === '.ts' || ext === '.tsx') {
      if (fixedPath === 'index') {
        exportsMap[`.`] = {
          import: `./${fixedPath}.js`,
          types: `./${fixedPath}.d.ts`,
        };
      } else if (fixedPath.endsWith('/index')) {
        exportsMap[`${fixedPath.split('/').slice(0, -1).join('/')}`] = {
          import: `./${fixedPath}.js`,
          types: `./${fixedPath}.d.ts`,
        };
      } else {
        exportsMap[`./${fixedPath}`] = {
          import: `./${fixedPath}.js`,
          types: `./${fixedPath}.d.ts`,
        };
      }
    } else {
      exportsMap[`./${fixedPath}`] = `./${fixedPath}${ext}`;
    }
  }

  return exportsMap;
};

writeFile(
  'dist/package.json',
  JSON.stringify(
    {
      ...JSON.parse(readFile('package.json')),
      exports: {
        './package.json': './package.json',
        ...lookupExportsMap('src'),
      },
    },
    null,
    2,
  ),
);
