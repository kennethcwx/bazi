'use client';

/**
 * Birthplace picker.
 *
 * A search field rather than a `<select>`. With ~130 places a native picker
 * becomes a scroll-hunt on a phone, and the thing people actually want to do
 * is type three letters of their city. Matching covers both languages, the
 * region and the IANA zone, so "japan", "日本", "gifu" and "岐阜" all land.
 *
 * The chosen place shows its longitude, because that is what drives the
 * 真太阳时 correction and it is the one number a user might want to sanity-check
 * against where they were actually born.
 */

import { useState, useRef, useEffect } from 'react';
import { PLACES, searchPlaces, type Place } from '../src/places';
import { UI } from '../src/i18n/ui';
import type { Locale } from '../src/i18n/text';

export function PlacePicker({ id, value, onChange, locale }: {
  id: string;
  value: number;
  onChange: (index: number) => void;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected: Place = PLACES[value] ?? PLACES[0]!;
  const results = open ? searchPlaces(query) : [];

  // Close on an outside click. Without this the list stays over the form on a
  // phone and the user has no obvious way out.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  function choose(place: Place) {
    onChange(PLACES.indexOf(place));
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="place" ref={wrapRef}>
      <label htmlFor={id}>{UI.birthPlace[locale]}</label>

      {open ? (
        <input
          id={id}
          type="text"
          value={query}
          autoFocus
          autoComplete="off"
          placeholder={UI.placeSearch[locale]}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); setQuery(''); }
            if (e.key === 'Enter' && results[0]) { e.preventDefault(); choose(results[0]); }
          }}
        />
      ) : (
        <button
          id={id}
          type="button"
          className="place-btn"
          onClick={() => setOpen(true)}
        >
          <span>{selected[locale]}</span>
          <span className="place-lon">{selected.lon.toFixed(2)}°</span>
        </button>
      )}

      {open && (
        <div className="place-list" role="listbox">
          {results.length === 0 && (
            <p className="place-empty">{UI.placeNoMatch[locale]}</p>
          )}
          {results.map((p) => (
            <button
              key={`${p.tz}:${p.lon}:${p.en}`}
              type="button"
              role="option"
              aria-selected={p === selected}
              className="place-opt"
              onClick={() => choose(p)}
            >
              <span className="place-name">{p[locale]}</span>
              <span className="place-meta">
                {p.region[locale]} · {p.lon.toFixed(2)}°
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
