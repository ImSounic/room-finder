"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PushToggle } from "@/components/PushToggle";

const tabs = [
  ["/listings", "Listings"],
  ["/applied", "Applied"],
  ["/replies", "Replies"],
] as const;

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center gap-1 px-3 py-2 sm:px-4">
        <Link
          href="/listings"
          className="mr-2 flex items-center gap-2 rounded-(--radius-control) px-1.5 py-1 font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-sm text-primary-ink"
          >
            ⌂
          </span>
          <span className="hidden sm:inline">Room Finder</span>
        </Link>
        {tabs.map(([href, label]) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-(--radius-control) px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                active
                  ? "bg-primary-soft text-primary"
                  : "text-muted hover:bg-surface hover:text-ink"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <PushToggle />
      </nav>
    </header>
  );
}
