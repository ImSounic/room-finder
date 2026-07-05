import type { Contact } from "@rf/core";

export function ContactPanel({ contact }: { contact: Contact | null }) {
  if (!contact) return null;
  const items = [
    contact.name && ["name", contact.name],
    contact.agency && ["agency", contact.agency],
    contact.email && ["email", contact.email],
    contact.phone && ["phone", contact.phone],
  ].filter(Boolean) as [string, string][];
  if (items.length === 0) return null;
  return (
    <div className="mt-2 rounded bg-neutral-100 dark:bg-neutral-900 p-2 text-xs">
      <div className="mb-1 text-neutral-500">contact (from public listing)</div>
      {items.map(([k, val]) => (
        <div key={k}>
          <span className="text-neutral-500">{k}: </span>
          {k === "email" ? <a className="underline" href={`mailto:${val}`}>{val}</a>
            : k === "phone" ? <a className="underline" href={`tel:${val}`}>{val}</a>
            : val}
        </div>
      ))}
    </div>
  );
}
