import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';

// Finds which of the user's still-out books appear in a photo of a pile of books.
// Nothing here changes any data: the caller shows the matches and the user confirms them.

export interface CandidateBook {
  id: string;
  title: string;
  author?: string;
}

export interface PhotoMatches {
  sure: string[]; // book ids the model clearly recognised
  maybe: string[]; // partly visible or uncertain; shown unticked
}

export class PhotoMatchUnavailableError extends Error {}

// Tried in order; the next one is used only when one is overloaded or rate-limited.
// Flash-Lite answered in ~1s and matched a test pile exactly; 3.8 Flash matched it too but took
// ~11s and often returned "high demand" on the free tier (2026-10). GEMINI_MODEL overrides both.
export const PHOTO_MATCH_MODELS = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];

const isBusy = (error: unknown) =>
  error instanceof ApiError && (error.status === 429 || error.status === 503);

// The model answers with list numbers rather than ids: shorter, and it can't invent an id.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sure: { type: 'array', items: { type: 'integer' } },
    maybe: { type: 'array', items: { type: 'integer' } },
  },
  required: ['sure', 'maybe'],
};

export function buildPrompt(books: CandidateBook[]): string {
  const list = books
    .map((book, i) => `${i + 1}. ${book.title}${book.author ? ` (${book.author})` : ''}`)
    .join('\n');

  return `The photo shows a pile of children's library books. Below is a numbered list of books that are checked out from the library. Which of the listed books can you see in the photo?

Count a book if you can see its front cover, back cover or spine. Put it in "sure" when you can read the title or clearly recognise the cover, and in "maybe" when it is partly hidden or you can't be certain. Leave out books you can't see, and never include anything that isn't on the list. Answer with list numbers only.

${list}`;
}

// Maps the model's list numbers back to book ids, dropping anything out of range or repeated.
// A book in both lists counts as sure.
export function parseMatches(
  responseText: string | undefined,
  books: CandidateBook[]
): PhotoMatches {
  let parsed: { sure?: unknown; maybe?: unknown };
  try {
    parsed = JSON.parse(responseText ?? '');
  } catch {
    throw new Error('Photo matching returned an unreadable answer');
  }

  const toIds = (numbers: unknown): string[] =>
    Array.isArray(numbers)
      ? numbers
          .filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= books.length)
          .map((n) => books[n - 1].id)
      : [];

  const sure = [...new Set(toIds(parsed.sure))];
  const maybe = [...new Set(toIds(parsed.maybe))].filter((id) => !sure.includes(id));
  return { sure, maybe };
}

// The slice of the Gemini client this module uses, so tests can pass a fake
export interface GeminiClient {
  models: Pick<GoogleGenAI['models'], 'generateContent'>;
}

function defaultClient(): GeminiClient {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new PhotoMatchUnavailableError('GEMINI_API_KEY is not set');
  }
  return new GoogleGenAI({ apiKey });
}

export async function findBooksInPhoto(
  image: { data: string; mimeType: string }, // base64
  books: CandidateBook[],
  client: GeminiClient = defaultClient()
): Promise<PhotoMatches> {
  if (books.length === 0) {
    return { sure: [], maybe: [] };
  }

  const request = {
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: image.data, mimeType: image.mimeType } },
          { text: buildPrompt(books) },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: RESPONSE_SCHEMA,
      // Spotting titles needs little reasoning, and less thinking keeps the request quick
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  };

  for (const [i, model] of PHOTO_MATCH_MODELS.entries()) {
    try {
      const response = await client.models.generateContent({ ...request, model });
      return parseMatches(response.text, books);
    } catch (error) {
      if (!isBusy(error) || i === PHOTO_MATCH_MODELS.length - 1) throw error;
    }
  }
  throw new Error('unreachable');
}
