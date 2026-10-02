// Due dates are calendar dates ('YYYY-MM-DD'). Parsing one with new Date() treats it as UTC
// midnight, which shows as the previous day in Vancouver, so they're handled as local dates.

export function parseDueDate(dueDate: string): Date {
	const [year, month, day] = dueDate.split('-').map(Number);
	return new Date(year, month - 1, day);
}

export function todayString(now: Date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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
