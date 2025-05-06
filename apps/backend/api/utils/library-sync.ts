import axios from 'axios';
import * as cheerio from 'cheerio';

export interface BookData {
  title: string;
  isbn?: string;
  dueDate: Date;
  coverImage?: string;
}

/**
 * Fetch checked out books from a library system using card number and PIN
 */
export async function getCheckedOutBooks(
  cardNumber: string,
  pin: string,
  librarySystem: string
): Promise<BookData[]> {
  if (librarySystem === 'nwpl') {
    return getNWPLBooks(cardNumber, pin);
  }

  // Add support for other library systems here
  throw new Error(`Unsupported library system: ${librarySystem}`);
}

/**
 * Fetch checked out books from the New Westminster Public Library system
 */
export async function getNWPLBooks(cardNumber: string, pin: string): Promise<BookData[]> {
  try {
    // Step 1: Fetch the login page to get the CSRF token
    const loginPageResponse = await axios.get(
      'https://newwestminster.bibliocommons.com/user/login',
      {
        withCredentials: true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          Referer: 'https://newwestminster.bibliocommons.com/',
        },
      }
    );

    // Extract CSRF token from the page
    const $ = cheerio.load(loginPageResponse.data);
    const csrfToken = $('meta[name="csrf-token"]').attr('content');
    if (!csrfToken) {
      throw new Error('CSRF token not found');
    }
    console.log('CSRF Token:', csrfToken);

    // Get all cookies from the login page response
    const cookies = loginPageResponse.headers['set-cookie'] || [];
    const cookieString = cookies.join('; ');

    // Step 2: Submit login form with credentials
    const loginResponse = await axios.post(
      'https://newwestminster.bibliocommons.com/user/login?destination=user_dashboard',
      {
        utf8: '✓',
        authenticity_token: csrfToken,
        name: cardNumber,
        user_pin: pin,
        local: 'false',
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRF-Token': csrfToken,
          'X-Requested-With': 'XMLHttpRequest',
          Cookie: cookieString,
          Referer: 'https://newwestminster.bibliocommons.com/user/login',
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',
        },
      }
    );

    // Extract session cookies
    const sessionCookies = loginResponse.headers['set-cookie'] || [];
    let sessionCookieString = sessionCookies.join('; ');

    // Remove 'Cookie: ' prefix if it exists
    if (sessionCookieString.startsWith('Cookie: ')) {
      sessionCookieString = sessionCookieString.substring(8);
    }

    // Filter to only include allowed cookies
    const allowedCookies = [
      '_live_bcui_session_id',
      'NERF_SRV',
      'branch',
      'session_id',
      'bc_access_token',
    ];
    const cookiePairs = sessionCookieString.split('; ').map((cookie) => cookie.split(';')[0]);
    const filteredCookies = cookiePairs.filter((cookie) => {
      const cookieName = cookie.split('=')[0].trim();
      return allowedCookies.includes(cookieName);
    });
    sessionCookieString = filteredCookies.join('; ');

    // Extract session ID and access token from cookies
    const sessionIdMatch = sessionCookieString.match(/(?:^|;\s*)session_id=([^;]*)/);
    const accessTokenMatch = sessionCookieString.match(/(?:^|;\s*)bc_access_token=([^;]*)/);
    console.log('Session Cookie String:', sessionCookieString);
    if (!sessionIdMatch || !accessTokenMatch) {
      throw new Error('Failed to extract session tokens');
    }

    let sessionId = sessionIdMatch[1];
    let accessToken = accessTokenMatch[1];

    console.log('Session ID:', sessionId);
    console.log('Access Token:', accessToken);

    // The account ID is normally in the response or can be extracted from the session ID
    // For this example, we'll extract it from the session ID which often has format: "session_id-accountId"
    let accountId = sessionId.split('-').pop() || '';
    if (!accountId) {
      throw new Error('Failed to extract account ID from session ID');
    }
    // Convert to number and add 1
    accountId = (parseInt(accountId) + 1).toString();

    const headers = {
      Referer: 'https://newwestminster.bibliocommons.com/',
      Origin: 'https://newwestminster.bibliocommons.com',
      'Sec-GPC': '1',
      Connection: 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      TE: 'trailers',
      Cookie: sessionCookieString,
      'X-Session-Id': sessionId,
      'X-Access-Token': accessToken,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0',
      Accept: 'application/json',
      'Accept-Language': 'en-CA,en-US;q=0.7,en;q=0.3',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      Pragma: 'no-cache',
      'Cache-Control': 'no-cache',
      Priority: 'u=0',
    };
    console.log('Headers:', headers);

    axios.interceptors.request.use(
      (config) => {
        console.log('Request:');
        console.log('  Method:', config.method);
        console.log('  URL:', config.url);
        console.log('  Headers:', config.headers);
        if (config.data) {
          console.log('  Body:', config.data);
        }
        return config;
      },
      (error) => {
        console.error('Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Step 4: Fetch checked out books
    const checkedOutResponse = await axios.get(
      `https://gateway.bibliocommons.com/v2/libraries/newwestminster/checkouts?accountId=${accountId}&size=100&status=OUT&page=1&sort=status&materialType=&locale=en-CA`,
      {
        withCredentials: true,
        headers,
      }
    );

    if (
      !checkedOutResponse.data ||
      !checkedOutResponse.data.entities ||
      !checkedOutResponse.data.entities.bibs
    ) {
      return [];
    }

    const books: BookData[] = [];
    const bibs = checkedOutResponse.data.entities.bibs;
    const checkouts = checkedOutResponse.data.entities.checkouts;

    // Process book data
    for (const checkoutId of Object.keys(checkouts)) {
      const checkout = checkouts[checkoutId];
      const metadataId = checkout.metadataId;
      const bib = bibs[metadataId];

      if (bib && bib.briefInfo) {
        const info = bib.briefInfo;
        books.push({
          title: info.title + (info.subtitle ? ': ' + info.subtitle : ''),
          isbn: info.isbns?.length > 0 ? info.isbns[0] : undefined,
          dueDate: new Date(checkout.dueDate),
          coverImage: info.jacket?.medium || info.jacket?.large || info.jacket?.small,
        });
      }
    }

    return books;
  } catch (error) {
    console.error('Error fetching NWPL books:', error);
    throw new Error(`Failed to fetch books from NWPL: ${error}`);
  }
}
