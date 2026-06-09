"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  loadGoogleFonts,
  searchTemplateFonts,
  type TemplateFontOption,
} from "@/lib/template-scene";

type FontPickerProps = {
  value: string;
  onChange: (fontFamily: string) => void;
  searchPlaceholder: string;
  noResultsLabel: string;
};

export function FontPicker({
  value,
  onChange,
  searchPlaceholder,
  noResultsLabel,
}: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredFonts = useMemo(() => searchTemplateFonts(query), [query]);

  useEffect(() => {
    loadGoogleFonts([value]);
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    loadGoogleFonts(filteredFonts.slice(0, 24).map((font) => font.family));
  }, [filteredFonts, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const handleSelect = (font: TemplateFontOption) => {
    loadGoogleFonts([font.family]);
    onChange(font.family);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex h-7 w-full min-w-0 items-center justify-between gap-1 border bg-background px-2 text-left text-xs hover:bg-muted/50"
        style={{ fontFamily: value }}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-50 border bg-background shadow-md">
          <div className="border-b p-2">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                placeholder={searchPlaceholder}
                className="h-8 pl-7 text-sm"
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {filteredFonts.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {noResultsLabel}
              </p>
            ) : (
              filteredFonts.map((font) => (
                <button
                  key={font.family}
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted",
                    font.family === value && "bg-primary/10",
                  )}
                  style={{ fontFamily: font.family }}
                  onClick={() => handleSelect(font)}
                >
                  <span className="truncate">{font.family}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {font.category}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
