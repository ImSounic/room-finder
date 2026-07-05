import type { Contact } from "@rf/core";

export function ContactPanel({ contact }: { contact: Contact | null }) {
  if (!contact) return null;
  const items = [
    contact.name && (["name", contact.name] as const),
    contact.agency && (["agency", contact.agency] as const),
    contact.email && (["email", contact.email] as const),
    contact.phone && (["phone", contact.phone] as const),
  ].filter(Boolean) as (readonly [string, string])[];
  if (items.length === 0) return null;
  return (
    <div className="mt-3 rounded-(--radius-control) bg-primary-soft/60 p-3 text-xs">
      <div className="mb-1.5 font-medium text-primary">Contact · from the public listing</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-ink">
        {items.map(([k, val]) => (
          <span key={k} className="inline-flex items-center gap-1">
            {k === "email" ? (
              <a className="font-medium underline decoration-primary/40 underline-offset-2 hover:text-primary" href={`mailto:${val}`}>✉️ {val}</a>
            ) : k === "phone" ? (
              <a className="font-medium underline decoration-primary/40 underline-offset-2 hover:text-primary" href={`tel:${val}`}>📞 {val}</a>
            ) : (
              <span>{k === "agency" ? "🏢" : "👤"} {val}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
