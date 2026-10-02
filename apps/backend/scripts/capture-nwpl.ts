// Saves raw BiblioCommons responses for one card, for building parsers against real data.
// GET requests only: nothing on the library account changes.
//
//   npx ts-node scripts/capture-nwpl.ts <libraryCardId>
//
// Reads the card from DATABASE_URL and writes to examples/nwpl/<date>/<cardId>/ (gitignored: it holds real
// account data). Prints only status codes and the shape of each response.
import fs from 'fs';
import path from 'path';
import { AppDataSource } from '../lib/ormconfig';
import { LibraryCard } from '../lib/entities/LibraryCard';
import { loginToNWPL } from '../lib/utils/library-sync';

const GATEWAY = 'https://gateway.bibliocommons.com/v2/libraries/newwestminster';

function shape(value: unknown, depth = 0): unknown {
  if (Array.isArray(value))
    return value.length ? [shape(value[0], depth + 1), `…${value.length}`] : [];
  if (value && typeof value === 'object') {
    if (depth > 3) return '{…}';
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 25)
        .map(([k, v]) => [k, shape(v, depth + 1)])
    );
  }
  return typeof value;
}

async function main() {
  const cardId = process.argv[2];
  // Without this, findOneBy({ id: undefined }) matches any card
  if (!cardId) {
    console.log('Usage: ts-node scripts/capture-nwpl.ts <libraryCardId>');
    process.exit(1);
  }
  await AppDataSource.initialize();
  const card = await AppDataSource.getRepository(LibraryCard).findOneByOrFail({ id: cardId });
  await AppDataSource.destroy();

  const session = await loginToNWPL(card.number, card.pin);
  const a = session.accountId;
  // Named by card id, not displayName: the name is user-entered and could contain '../'
  const outDir = path.join('examples/nwpl', new Date().toISOString().slice(0, 10), card.id);
  fs.mkdirSync(outDir, { recursive: true });

  const endpoints: Record<string, string> = {
    checkouts: `/checkouts?accountId=${a}&size=100&status=OUT&page=1&sort=status&materialType=&locale=en-CA`,
    holds: `/holds?accountId=${a}&size=100&page=1&locale=en-CA`,
    fines: `/fines?accountId=${a}&locale=en-CA`,
    fees: `/fees?accountId=${a}&locale=en-CA`,
    borrowingHistory: `/borrowinghistory?accountId=${a}&page=1&locale=en-CA`,
    account: `/accounts/${a}?locale=en-CA`,
    summary: `/borrowing/summary?accountId=${a}&locale=en-CA`,
  };
  for (const [name, url] of Object.entries(endpoints)) {
    const response = await fetch(GATEWAY + url, { headers: session.headers });
    const text = await response.text();
    fs.writeFileSync(path.join(outDir, `${name}.${response.ok ? 'json' : 'error.txt'}`), text);
    console.log(`${name}: ${response.status}`);
    if (response.ok) console.log(JSON.stringify(shape(JSON.parse(text))).slice(0, 1500));
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
