import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port number.');
const app = await createApp();
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Back track local server: http://127.0.0.1:${port}`);
});
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Choose a different PORT or stop that server.` : error.message);
  process.exitCode = 1;
});
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
});
