import { parseArgs } from 'node:util';
import { readConfig } from './readConfig';
import { RedisConnectionPoolImpl } from './RedisConnectionPool';
import { ApiKeyRepository } from './ApiKeyRepository';


const usage = `Управление ключами API mail-server (хранятся в Redis из конфига сервера)

  api-keys add <имя> [--proxy]   создать ключ и вывести его (показывается один раз);
                                 --proxy — ключ фронта, которому сервер верит
                                 в заголовке X-Remote-User
  api-keys list                  имя, тип, дата создания, последнее использование
  api-keys revoke <имя>          отозвать ключ`;

async function main () {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { help: { short: 'h', type: 'boolean' }, proxy: { type: 'boolean' } }
  });
  const [command, name] = positionals;
  if (values.help || !command) {
    console.log(usage);
    return 0;
  }
  if ((command === 'add' || command === 'revoke') && !name) {
    console.error(`Usage: api-keys ${command} <name>`);
    return 2;
  }

  const config = readConfig();
  const pool = new RedisConnectionPoolImpl(config.server.redis, { max: 1, min: 1 });
  const repository = new ApiKeyRepository(pool, config.server.redis.prefixes);
  try {
    switch (command) {
      case 'add': {
        const key = await repository.add(name, values.proxy);
        if (!key) {
          console.error(`Key "${name}" already exists; revoke it first to issue a new one`);
          return 1;
        }
        console.log(key);
        return 0;
      }
      case 'list': {
        for (const record of await repository.list()) {
          console.log([
            record.name, record.proxy ? 'proxy' : 'client', record.createdAt,
            record.lastUsedAt || 'never'
          ].join('\t'));
        }
        return 0;
      }
      case 'revoke':
        if (!await repository.revoke(name)) {
          console.error(`No key "${name}"`);
          return 1;
        }
        console.log(`Revoked "${name}"`);
        return 0;
      default:
        console.error(`Unknown command "${command}"\n\n${usage}`);
        return 2;
    }
  } finally {
    await pool.close();
  }
}

main().then(code => {
  process.exitCode = code;
}, error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
