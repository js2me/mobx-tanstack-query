#!/usr/bin/env tsx


import { readFileSync } from "fs";
import { resolve } from "path";
import { postBuildScript } from "sborshik/post-build-script";

console.log(process.cwd())

const tsconfig = JSON.parse(readFileSync(resolve(process.cwd(), './tsconfig.json')).toString())

function prepareDist() {
  postBuildScript({
    buildDir: 'dist',
    rootDir: '.',
    srcDirName: 'src',
    useBuildDirForExportsMap: true,
    filterExportsPathFn: (path) => {
      return path.startsWith('~');
    },
    onDone: (_, pckgJson) => {
      const dirLibsPaths = (Object.entries(tsconfig.compilerOptions.paths) as unknown as [string, string[]]).filter((entry) => { 
        return entry[1][0].endsWith('/index.ts'); 
      }).map(entry => {
        const libName = entry[0].replace(`${pckgJson.data.name}/`, '')
        return `./${libName}`
      })
      const dirLibsSet = new Set(dirLibsPaths)
      Object.keys(pckgJson.data.exports).forEach(exportPath=> {
        if (typeof pckgJson.data.exports[exportPath] !== 'object') {
          return;
        }

        if (exportPath === './index') {
          const exportMap = pckgJson.data.exports[exportPath]
          delete pckgJson.data.exports[exportPath]
          pckgJson.data.exports['.'] = exportMap
          exportPath = '.'
        }

        if (!pckgJson.data.exports[exportPath].require) {
          pckgJson.data.exports[exportPath].require = pckgJson.data.exports[exportPath].import.replace('.js', '.cjs')
        }

        if (dirLibsSet.has(exportPath)) {
          pckgJson.data.exports[exportPath].types = `${exportPath}/index.d.ts`
        }
      })

      pckgJson.syncWithFs();
    },
    addRequireToExportsMap: true,
    filesToCopy: ['LICENSE', 'README.md'],
  })
  
  console.log('Dist prepared OK');
}

// Run the script
prepareDist();