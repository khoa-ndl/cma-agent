"use client";

import { useEffect, useRef, useState } from "react";
import type { AddressMatch } from "@/lib/data/provider";

const DEBOUNCE_MS = 250;

export function AddressAutocomplete({ onSelect }: { onSelect: (match: AddressMatch) => void }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<AddressMatch[]>([]);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    const timeout = setTimeout(async () => {
      if (query.trim().length === 0) {
        setMatches([]);
        return;
      }
      const response = await fetch(`/api/addresses?q=${encodeURIComponent(query)}`);
      if (id !== requestId.current || !response.ok) return; // a newer query already superseded this one
      const body = (await response.json()) as { matches: AddressMatch[] };
      setMatches(body.matches);
      setOpen(true);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="relative flex flex-col gap-2">
      <label htmlFor="address" className="text-sm font-medium text-(--color-foreground)">
        Address
      </label>
      <input
        id="address"
        type="text"
        autoComplete="off"
        placeholder="Start typing an address…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => matches.length > 0 && setOpen(true)}
        className="rounded-lg border border-(--color-border) px-4 py-3 text-base text-(--color-foreground) outline-none focus:border-(--color-ring) focus:ring-3 focus:ring-(--color-ring)/20"
      />
      {open && matches.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-(--color-border) bg-(--color-card) shadow-lg">
          {matches.map((match) => (
            <li key={match.listingKey}>
              <button
                type="button"
                onClick={() => {
                  setQuery(match.unparsedAddress);
                  setOpen(false);
                  onSelect(match);
                }}
                className="w-full cursor-pointer px-4 py-3 text-left text-sm hover:bg-(--color-muted)"
              >
                <span className="font-medium text-(--color-foreground)">{match.unparsedAddress}</span>{" "}
                <span className="text-(--color-muted-foreground)">
                  {match.city} · {match.mlsAreaMajor}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
