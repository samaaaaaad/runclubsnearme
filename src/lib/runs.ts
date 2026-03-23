type RecurringRunLike = {
    date: string;
    time: string;
    is_recurring_weekly?: boolean | null;
};

type ExpandRunsOptions = {
    fromDate?: Date;
    horizonDays?: number;
    maxOccurrences?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
}

function toDateKey(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function parseTimeToMinutes(timeStr: string): number {
    const value = timeStr.trim();
    const ampm = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (ampm) {
        let hour = Number(ampm[1]);
        const minute = Number(ampm[2] || "0");
        const meridiem = ampm[3].toUpperCase();
        if (meridiem === "PM" && hour !== 12) hour += 12;
        if (meridiem === "AM" && hour === 12) hour = 0;
        return hour * 60 + minute;
    }

    const hhmm = value.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmm) {
        return Number(hhmm[1]) * 60 + Number(hhmm[2]);
    }

    return 0;
}

function compareRunDateTime(a: RecurringRunLike, b: RecurringRunLike): number {
    if (a.date === b.date) {
        return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
    }
    return a.date.localeCompare(b.date);
}

export function expandRunsForUpcoming<T extends RecurringRunLike>(runs: T[], options?: ExpandRunsOptions): T[] {
    const from = options?.fromDate ? new Date(options.fromDate) : new Date();
    from.setHours(0, 0, 0, 0);

    const horizonDays = options?.horizonDays ?? 90;
    const maxOccurrences = options?.maxOccurrences ?? 120;
    const horizon = new Date(from.getTime() + horizonDays * DAY_MS);

    const expanded: T[] = [];

    for (const run of runs) {
        const baseDate = parseLocalDate(run.date);
        baseDate.setHours(0, 0, 0, 0);

        if (!run.is_recurring_weekly) {
            if (baseDate >= from && baseDate <= horizon) {
                expanded.push(run);
            }
            continue;
        }

        const first = new Date(baseDate);
        if (first < from) {
            const diffDays = Math.floor((from.getTime() - first.getTime()) / DAY_MS);
            const jumpWeeks = Math.floor(diffDays / 7);
            first.setDate(first.getDate() + jumpWeeks * 7);
            if (first < from) {
                first.setDate(first.getDate() + 7);
            }
        }

        let current = new Date(first);
        let created = 0;
        while (current <= horizon && created < maxOccurrences) {
            expanded.push({
                ...run,
                date: toDateKey(current),
            });
            current = new Date(current.getTime() + 7 * DAY_MS);
            created += 1;
        }
    }

    expanded.sort(compareRunDateTime);
    return expanded;
}
