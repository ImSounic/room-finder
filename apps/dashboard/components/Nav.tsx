import Link from "next/link";

const tabs = [["/listings", "Listings"], ["/applied", "Applied"], ["/replies", "Replies"]] as const;

export function Nav() {
  return (
    <nav className="flex gap-4 border-b px-4 py-3 text-sm font-medium sticky top-0 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur z-10">
      {tabs.map(([href, label]) => (
        <Link key={href} href={href} className="hover:underline">{label}</Link>
      ))}
    </nav>
  );
}
