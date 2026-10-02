// Due dates are calendar dates ('YYYY-MM-DD'). Parsing one with new Date() treats it as UTC
// midnight, which shows as the previous day in Vancouver, so they're handled as local dates.

export function parseDueDate(dueDate: string): Date {
	const [year, month, day] = dueDate.split('-').map(Number);
	return new Date(year, month - 1, day);
}

// "Today" is Vancouver's day, matching the API's overdue filter, wherever the browser is.
// Make this per library system if a library elsewhere is added.
const LIBRARY_TIME_ZONE = 'America/Vancouver';

// en-CA formats dates as YYYY-MM-DD
export function todayString(now: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: LIBRARY_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

// Overdue from the day after the due date. 'YYYY-MM-DD' strings compare correctly as text.
export function isOverdue(dueDate: string | undefined, today = todayString()): boolean {
	return !!dueDate && dueDate < today;
}

// Whole days from today to the due date: 0 = due today, negative = overdue
export function daysUntilDue(dueDate: string, now: Date = new Date()): number {
	const today = parseDueDate(todayString(now));
	return Math.round((parseDueDate(dueDate).getTime() - today.getTime()) / 86_400_000);
}
