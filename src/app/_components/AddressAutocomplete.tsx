"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { AddressMatch } from "@/lib/data/provider";

const DEBOUNCE_MS = 250;

export function AddressAutocomplete({ onSelect }: { onSelect: (match: AddressMatch) => void }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<AddressMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const requestId = useRef(0);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  // select() sets query to the picked address so the input shows it — but
  // that's a query change too, which would otherwise re-trigger this same
  // search effect and reopen the dropdown with the just-picked address as
  // its own match.
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
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
      setHighlighted(-1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    optionRefs.current[highlighted]?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  function select(match: AddressMatch) {
    skipNextSearch.current = true;
    setQuery(match.unparsedAddress);
    setOpen(false);
    setHighlighted(-1);
    onSelect(match);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlighted((i) => (i + 1) % matches.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted((i) => (i <= 0 ? matches.length - 1 : i - 1));
        break;
      case "Enter":
        if (highlighted >= 0) {
          e.preventDefault();
          select(matches[highlighted]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setHighlighted(-1);
        break;
    }
  }

  const listboxId = "address-listbox";

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
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={highlighted >= 0 ? `address-option-${highlighted}` : undefined}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => matches.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        className="rounded-lg border border-(--color-border) px-4 py-3 text-base text-(--color-foreground) outline-none focus:border-(--color-ring) focus:ring-3 focus:ring-(--color-ring)/20"
      />
      {open && matches.length > 0 && (
        <ul id={listboxId} role="listbox" className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-(--color-border) bg-(--color-card) shadow-lg">
          {matches.map((match, i) => (
            <li
              key={match.listingKey}
              id={`address-option-${i}`}
              role="option"
              aria-selected={i === highlighted}
              ref={(node) => {
                optionRefs.current[i] = node;
              }}
            >
              <button
                type="button"
                tabIndex={-1}
                onClick={() => select(match)}
                onMouseEnter={() => setHighlighted(i)}
                className={
                  "w-full cursor-pointer px-4 py-3 text-left text-sm" +
                  (i === highlighted ? " bg-(--color-muted)" : " hover:bg-(--color-muted)")
                }
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
