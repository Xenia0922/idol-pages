const eventImages: Record<string, string> = {
  "live-2026-08-01": "/images/events/live-2026-08-01.webp",
  "live-2026-07-15": "/images/events/live-2026-07-15.webp",
  "live-2026-06-20": "/images/events/live-2026-06-20.webp",
};
export function getEventImage(
  eventId: string,
  fallback = "/images/events/placeholder.webp",
) {
  return eventImages[eventId] || fallback;
}
