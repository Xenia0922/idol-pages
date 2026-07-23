import EventCardGrid, { type EventRow } from "./EventCardGrid";

export type { EventRow };

export default function UpcomingEvents({ initial }: { initial: EventRow[] }) {
  return (
    <EventCardGrid
      initial={initial}
      filter="upcoming"
      sortDir="asc"
      limit={4}
    />
  );
}
