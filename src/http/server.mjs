import { readConfig } from '../config.mjs';
import { createApp } from './app.mjs';

try {
  const config = readConfig(process.env);
  createApp({ config }).listen(config.port, config.host, () => console.log(`Image relevance API listening on port ${config.port}`));
} catch {
  console.error('Startup failed: check local configuration and services.');
  process.exitCode = 1;
}
