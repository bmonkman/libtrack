import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@google/genai';
import {
  buildPrompt,
  findBooksInPhoto,
  GeminiClient,
  parseMatches,
  PHOTO_MATCH_MODELS,
} from './photo-match';

const books = [
  { id: 'a', title: 'The Gruffalo', author: 'Julia Donaldson' },
  { id: 'b', title: 'Corduroy' },
  { id: 'c', title: 'Owl Moon', author: 'Jane Yolen' },
];

test('the prompt numbers each book with its author when known', () => {
  const prompt = buildPrompt(books);
  assert.match(prompt, /^1\. The Gruffalo \(Julia Donaldson\)$/m);
  assert.match(prompt, /^2\. Corduroy$/m);
  assert.match(prompt, /^3\. Owl Moon \(Jane Yolen\)$/m);
});

test('list numbers map back to book ids', () => {
  assert.deepEqual(parseMatches('{"sure":[1,3],"maybe":[2]}', books), {
    sure: ['a', 'c'],
    maybe: ['b'],
  });
});

test('out-of-range, repeated and non-integer numbers are dropped; sure beats maybe', () => {
  assert.deepEqual(parseMatches('{"sure":[1,1,0,4,2.5,"2"],"maybe":[1,3,9]}', books), {
    sure: ['a'],
    maybe: ['c'],
  });
});

test('an unreadable answer throws instead of looking like "nothing found"', () => {
  for (const answer of [
    'not json',
    undefined,
    '{}',
    'null',
    '{"sure":"unknown","maybe":[]}',
    '{"sure":[1]}',
  ]) {
    assert.throws(() => parseMatches(answer, books), /unreadable/, String(answer));
  }
});

test('sends the photo and the numbered list, and asks for JSON', async () => {
  let request: any;
  const client = {
    models: {
      generateContent: async (params: unknown) => {
        request = params;
        return { text: '{"sure":[2],"maybe":[]}' };
      },
    },
  } as unknown as GeminiClient;

  const matches = await findBooksInPhoto({ data: 'aW1n', mimeType: 'image/jpeg' }, books, client);

  assert.deepEqual(matches, { sure: ['b'], maybe: [] });
  const [photo, prompt] = request.contents[0].parts;
  assert.deepEqual(photo, { inlineData: { data: 'aW1n', mimeType: 'image/jpeg' } });
  assert.match(prompt.text, /2\. Corduroy/);
  assert.equal(request.config.responseMimeType, 'application/json');
});

test('with no books still out, nothing is called, even without an API key', async () => {
  const key = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    assert.deepEqual(await findBooksInPhoto({ data: '', mimeType: 'image/jpeg' }, []), {
      sure: [],
      maybe: [],
    });
  } finally {
    if (key !== undefined) process.env.GEMINI_API_KEY = key;
  }
});

test('with no books still out, the model is not called', async () => {
  const client = {
    models: {
      generateContent: async () => assert.fail('should not be called'),
    },
  } as unknown as GeminiClient;

  assert.deepEqual(await findBooksInPhoto({ data: '', mimeType: 'image/jpeg' }, [], client), {
    sure: [],
    maybe: [],
  });
});

const fakeClient = (answers: Array<string | Error>) => {
  const models: string[] = [];
  const client = {
    models: {
      generateContent: async ({ model }: { model: string }) => {
        models.push(model);
        const answer = answers.shift();
        if (answer instanceof Error) throw answer;
        return { text: answer };
      },
    },
  } as unknown as GeminiClient;
  return { client, models };
};

test('a busy model falls back to the next one', async () => {
  const { client, models } = fakeClient([
    new ApiError({ message: 'high demand', status: 503 }),
    '{"sure":[1],"maybe":[]}',
  ]);

  const matches = await findBooksInPhoto({ data: 'x', mimeType: 'image/jpeg' }, books, client);

  assert.deepEqual(matches, { sure: ['a'], maybe: [] });
  assert.deepEqual(models, PHOTO_MATCH_MODELS.slice(0, 2));
});

test('other errors do not fall back, and the last busy error is passed on', async () => {
  const bad = fakeClient([new ApiError({ message: 'bad request', status: 400 })]);
  await assert.rejects(
    findBooksInPhoto({ data: 'x', mimeType: 'image/jpeg' }, books, bad.client),
    /bad request/
  );
  assert.equal(bad.models.length, 1);

  const busy = fakeClient(
    PHOTO_MATCH_MODELS.map(() => new ApiError({ message: 'busy', status: 429 }))
  );
  await assert.rejects(
    findBooksInPhoto({ data: 'x', mimeType: 'image/jpeg' }, books, busy.client),
    (error: unknown) => error instanceof ApiError && error.status === 429
  );
  assert.equal(busy.models.length, PHOTO_MATCH_MODELS.length);
});
