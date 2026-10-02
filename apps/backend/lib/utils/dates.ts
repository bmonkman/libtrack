// The supported library systems are all in the Vancouver area, so "today" for due dates means
// today there, not on the UTC server. Make this per-system if a library elsewhere is added.
const LIBRARY_TIME_ZONE = 'America/Vancouver';

// Today's date in the library's time zone, as 'YYYY-MM-DD' (en-CA formats dates that way)
export function todayInLibraryTimeZone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LIBRARY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
