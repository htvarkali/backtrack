import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const commands = [
  ['--env-file-if-exists=.env', 'backend/server.js'],
  ['node_modules/vite/bin/vite.js'],
];
const children = commands.map((args) => spawn(process.execPath, args, {
  cwd: root,
  env: { ...process.env, PORT: '3001', NODE_ENV: 'development' },
  stdio: 'inherit',
}));
let shuttingDown = false;
function stop(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = exitCode;
}
for (const child of children) {
  child.once('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.once('exit', (code) => stop(code ?? 0));
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
