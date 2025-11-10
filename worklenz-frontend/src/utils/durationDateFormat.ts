import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/de';
import 'dayjs/locale/es';
import 'dayjs/locale/pt';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/ko';

// Extend dayjs with relativeTime plugin for .fromNow() functionality
dayjs.extend(relativeTime);

/**
 * Formats a date as a relative time string (e.g., "2 days ago", "vor 2 Tagen")
 * Uses dayjs with locale support to display dates in the user's selected language
 * @param date Date to format (Date object, string, or undefined)
 * @returns Localized relative time string or '-' if date is invalid
 * @example
 * durationDateFormat(new Date('2023-01-01')) // "1 year ago" (English)
 * durationDateFormat(new Date('2023-01-01')) // "vor 1 Jahr" (German)
 */
export const durationDateFormat = (date: Date | null | string | undefined): string => {
  if (!date) return '-';

  try {
    // Use dayjs to format the date relative to now
    // The locale is automatically taken from the global dayjs locale
    // which is set in App.tsx and localesSlice.ts when language changes
    return dayjs(date).fromNow();
  } catch (error) {
    // Fallback in case of invalid date
    console.error('Error formatting date:', error);
    return '-';
  }
};
