import { EntryStatus } from "@/lib/types/ap";

export function StatusBadge({ status }: { status: EntryStatus }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}