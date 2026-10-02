// Try photo matching on a real photo before changing the prompt or model.
//
//   npx ts-node scripts/try-photo-match.ts <photo.jpg> <books.json> [model ...]
//
// books.json is [{ "id", "title", "author" }] (e.g. a user's still-out books). Prints what each
// model matched and how long it took. Uses GEMINI_API_KEY from .env; on the free tier Google may
// use the photo for training, so don't send photos with people in them.
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const [photo, booksFile, ...models] = process.argv.slice(2);
  if (!photo || !booksFile) {
    console.log('Usage: ts-node scripts/try-photo-match.ts <photo.jpg> <books.json> [model ...]');
    process.exit(1);
  }
  const books: { id: string; title: string }[] = JSON.parse(fs.readFileSync(booksFile, 'utf8'));
  const image = { data: fs.readFileSync(photo).toString('base64'), mimeType: 'image/jpeg' };
  const title = (id: string) => books.find((book) => book.id === id)?.title;

  for (const model of models.length ? models : ['gemini-3.8-flash', 'gemini-3.5-flash-lite']) {
    // The model is read when photo-match loads, so load a fresh copy for each one
    process.env.GEMINI_MODEL = model;
    delete require.cache[require.resolve('../lib/utils/photo-match')];
    const { findBooksInPhoto } = require('../lib/utils/photo-match');

    const start = Date.now();
    const seconds = () => ((Date.now() - start) / 1000).toFixed(1);
    try {
      const matches = await findBooksInPhoto(image, books);
      console.log(`${model} (${seconds()}s)`);
      console.log('  sure: ', matches.sure.map(title).join(' | ') || '-');
      console.log('  maybe:', matches.maybe.map(title).join(' | ') || '-');
    } catch (error: any) {
      console.log(`${model} failed after ${seconds()}s: ${error?.status ?? ''} ${error?.message}`);
    }
  }
}

main();
