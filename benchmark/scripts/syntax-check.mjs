import {spawnSync} from 'node:child_process';
for (const file of process.argv.slice(2)) {
 const result = spawnSync(process.execPath, ['--check', file], {encoding: 'utf8'});
 if (result.status !== 0) {process.stderr.write(result.stderr); process.exit(result.status ?? 1);}
}
console.log(`Syntax passed for ${process.argv.length - 2} JavaScript files. TypeScript is covered only where the project declares typecheck.`);
