import EventCardGrid, { type EventRow } from "./EventCardGrid";

export type { EventRow };

export default function HomeEvents({ initial }: { initial: EventRow[] }) {
  return (
    <EventCardGrid
      initial={initial}
      filter="past"
      sortDir="desc"
      limit={4}
      fallbackImg="/images/events/live-2026-01-31.webp"
    />
  );
}
