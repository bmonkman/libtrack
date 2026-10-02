import * as cheerio from 'cheerio';

export interface BookData {
  checkoutId: string;
  metadataId?: string; // the library's id for the title (bib), shared by every copy
  title: string;
  author?: string;
  isbn?: string;
  dueDate: string; // 'YYYY-MM-DD'
  coverImage?: string;
}

// BiblioCommons lists authors as 'Last, First' (sometimes with dates: 'Carle, Eric, 1929-2021').
// Shows the first author as 'First Last'; anything that isn't that shape is left as is.
export function formatAuthor(authors?: string[]): string | undefined {
  if (!authors?.length) return undefined;
  const parts = authors[0]
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/^\d{4}/.test(part));
  const name = parts.length === 2 ? `${parts[1]} ${parts[0]}` : parts.join(', ');
  return authors.length > 1 ? `${name} and others` : name;
}

// One page of the gateway's checkouts response. The caller marks any book missing from the
// result as returned, so anything that doesn't add up throws rather than reading as "no
// checkouts". borrowing.checkouts.items lists the page's checkout IDs; each must have its
// details in entities.checkouts. Zero checkouts is an empty items list with count 0.
export function parseCheckoutsPage(data: any): { books: BookData[]; pages: number; total: number } {
  const listing = data?.borrowing?.checkouts;
  if (!Array.isArray(listing?.items) || typeof listing?.pagination?.count !== 'number') {
    throw new Error('Unexpected checkouts response shape');
  }

  const bibs = data.entities?.bibs ?? {};
  const details = data.entities?.checkouts ?? {};
  const books = listing.items.map((checkoutId: string): BookData => {
    const checkout = details[checkoutId];
    if (!checkout) {
      throw new Error(`Checkout ${checkoutId} is listed without details`);
    }
    const info = bibs[checkout.metadataId]?.briefInfo;
    return {
      checkoutId: String(checkout.checkoutId),
      metadataId: checkout.metadataId ?? undefined,
      title: info ? info.title + (info.subtitle ? ': ' + info.subtitle : '') : checkout.bibTitle,
      author: formatAuthor(info?.authors),
      isbn: info?.isbns?.length > 0 ? info.isbns[0] : undefined,
      dueDate: checkout.dueDate,
      coverImage: info?.jacket?.medium || info?.jacket?.large || info?.jacket?.small,
    };
  });

  return { books, pages: listing.pagination.pages ?? 1, total: listing.pagination.count };
}

// One charge or credit on a card. Credits have negative amounts.
export interface LibraryFine {
  fineId: string;
  amountCents: number;
  status: string; // e.g. 'UNPAID', 'CREDIT'
  description: string; // e.g. 'Lost', 'Credit'
  metadataId?: string;
  title?: string; // 'Title: Subtitle', the same shape as BookData.title
}

// One page of the gateway's fines response. Same rule as checkouts: anything that doesn't add up
// throws, because a missing lost charge would let the sync mark that book returned.
export function parseFinesPage(data: any): {
  fines: LibraryFine[];
  totalPages: number;
  total: number;
} {
  const listing = data?.borrowing?.fines;
  if (!Array.isArray(listing?.results) || typeof listing?.pagination?.totalElements !== 'number') {
    throw new Error('Unexpected fines response shape');
  }

  const details = data.entities?.fines ?? {};
  const fines = listing.results.map((fineId: string): LibraryFine => {
    const fine = details[fineId];
    // status and description decide whether a fine is a lost charge, so they're required too
    if (
      !fine ||
      typeof fine.amount !== 'number' ||
      typeof fine.status !== 'string' ||
      typeof fine.description !== 'string'
    ) {
      throw new Error(`Fine ${fineId} is listed without details`);
    }
    return {
      fineId: String(fineId),
      amountCents: Math.round(fine.amount * 100),
      status: fine.status,
      description: fine.description,
      metadataId: fine.metadataId ?? undefined,
      title: fine.bibTitle
        ? fine.bibTitle + (fine.bibSubtitle ? ': ' + fine.bibSubtitle : '')
        : undefined,
    };
  });

  return {
    fines,
    totalPages: listing.pagination.totalPages ?? 1,
    total: listing.pagination.totalElements,
  };
}

export interface LibraryAccount {
  checkouts: BookData[];
  fines: LibraryFine[];
}

/**
 * Fetch a card's current checkouts and fines from its library system
 */
export async function getLibraryAccount(
  cardNumber: string,
  pin: string,
  librarySystem: string
): Promise<LibraryAccount> {
  if (librarySystem === 'nwpl') {
    return getNWPLAccount(cardNumber, pin);
  }

  // Add support for other library systems here
  throw new Error(`Unsupported library system: ${librarySystem}`);
}

const NWPL_SITE = 'https://newwestminster.bibliocommons.com';
const NWPL_GATEWAY = 'https://gateway.bibliocommons.com/v2/libraries/newwestminster';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0';

// Requests use Node's built-in fetch, not axios: as of October 2026 the library's load balancer
// answers 403 to connections made through Node's https module (what axios uses), while fetch,
// curl and browsers get through. Probably why synced books stopped arriving after August 2026.

// A logged-in BiblioCommons session: the headers every gateway call needs, and the account
// they act on
export interface LibrarySession {
  accountId: string;
  headers: Record<string, string>;
}

class LibraryHttpError extends Error {
  constructor(
    readonly status: number,
    method: string,
    url: string
  ) {
    // Path only: query strings can carry the account id
    super(`${status} ${method} ${url.split('?')[0]}`);
  }
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, init);
  const redirect = response.status >= 300 && response.status < 400;
  if (!response.ok && !redirect) {
    throw new LibraryHttpError(response.status, init.method ?? 'GET', url);
  }
  return response;
}

// Errors carry only a status and a path; nothing from the login request (the PIN) leaks out
async function withSafeErrors<T>(action: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const detail =
      error instanceof LibraryHttpError || !(error instanceof TypeError)
        ? String(error instanceof Error ? error.message : error)
        : `no response (${error.message})`;
    throw new Error(`${action}: ${detail}`);
  }
}

// Adds the name=value pairs from a response's Set-Cookie headers to the jar (later ones win)
function storeCookies(response: Response, jar: Map<string, string>): Map<string, string> {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0];
    const split = pair.indexOf('=');
    if (split > 0) jar.set(pair.slice(0, split).trim(), pair.slice(split + 1).trim());
  }
  return jar;
}

const cookieHeader = (jar: Map<string, string>, names?: string[]) =>
  [...jar]
    .filter(([name]) => !names || names.includes(name))
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

/**
 * Log in to the New Westminster Public Library with a card number and PIN
 */
export async function loginToNWPL(cardNumber: string, pin: string): Promise<LibrarySession> {
  return withSafeErrors('Failed to log in to NWPL', async () => {
    // Step 1: the login page sets the first cookies and holds the CSRF token. This is the URL
    // /user/login redirects to, so no redirect (and no lost cookies) is involved.
    const loginPage = await request(`${NWPL_SITE}/user/login?destination=%2Fuser_dashboard`, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    const jar = storeCookies(loginPage, new Map());
    const csrfToken = cheerio
      .load(await loginPage.text())('meta[name="csrf-token"]')
      .attr('content');
    if (!csrfToken) {
      throw new Error('CSRF token not found');
    }

    // Step 2: submit the card number and PIN. redirect: 'manual' keeps the session cookies set
    // on this response, which following a redirect would drop.
    const loginResponse = await request(`${NWPL_SITE}/user/login?destination=user_dashboard`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRF-Token': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookieHeader(jar),
        Referer: `${NWPL_SITE}/user/login`,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'User-Agent': USER_AGENT,
      },
      body: new URLSearchParams({
        utf8: '✓',
        authenticity_token: csrfToken,
        name: cardNumber,
        user_pin: pin,
        local: 'false',
      }),
    });
    storeCookies(loginResponse, jar);

    const sessionId = jar.get('session_id');
    const accessToken = jar.get('bc_access_token');
    if (!sessionId || !accessToken) {
      throw new Error('No session after login (wrong card number or PIN?)');
    }

    // The gateway account id is the number at the end of session_id, plus one. Every open-source
    // BiblioCommons client does the same; BiblioCommons doesn't document it.
    const sessionNumber = parseInt(sessionId.split('-').pop() ?? '', 10);
    if (Number.isNaN(sessionNumber)) {
      throw new Error('Failed to extract account ID from session ID');
    }
    const accountId = String(sessionNumber + 1);

    const headers = {
      Referer: `${NWPL_SITE}/`,
      Origin: NWPL_SITE,
      Cookie: cookieHeader(jar, [
        '_live_bcui_session_id',
        'NERF_SRV',
        'branch',
        'session_id',
        'bc_access_token',
      ]),
      'X-Session-Id': sessionId,
      'X-Access-Token': accessToken,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      'Accept-Language': 'en-CA,en-US;q=0.7,en;q=0.3',
    };

    return { accountId, headers };
  });
}

async function fetchNWPLCheckouts(session: LibrarySession): Promise<BookData[]> {
  const books: BookData[] = [];
  let total = 0;
  for (let page = 1, pages = 1; page <= pages; page++) {
    const response = await request(
      `${NWPL_GATEWAY}/checkouts?accountId=${session.accountId}&size=100&status=OUT&page=${page}&sort=status&materialType=&locale=en-CA`,
      { headers: session.headers }
    );
    const parsed = parseCheckoutsPage(await response.json());
    books.push(...parsed.books);
    pages = parsed.pages;
    total = parsed.total;
  }
  if (books.length !== total) {
    throw new Error(`Checkouts count mismatch: got ${books.length}, expected ${total}`);
  }

  return books;
}

// Pages are numbered from 1 in the request (the response counts from 0)
async function fetchNWPLFines(session: LibrarySession): Promise<LibraryFine[]> {
  const fines: LibraryFine[] = [];
  let total = 0;
  for (let page = 1, pages = 1; page <= pages; page++) {
    const response = await request(
      `${NWPL_GATEWAY}/fines?accountId=${session.accountId}&size=100&page=${page}&locale=en-CA`,
      { headers: session.headers }
    );
    const parsed = parseFinesPage(await response.json());
    fines.push(...parsed.fines);
    pages = parsed.totalPages;
    total = parsed.total;
  }
  if (fines.length !== total) {
    throw new Error(`Fines count mismatch: got ${fines.length}, expected ${total}`);
  }
  return fines;
}

/**
 * Fetch a New Westminster Public Library card's checkouts and fines with one login
 */
export async function getNWPLAccount(cardNumber: string, pin: string): Promise<LibraryAccount> {
  const session = await loginToNWPL(cardNumber, pin);
  return withSafeErrors('Failed to fetch account from NWPL', async () => ({
    checkouts: await fetchNWPLCheckouts(session),
    fines: await fetchNWPLFines(session),
  }));
}
