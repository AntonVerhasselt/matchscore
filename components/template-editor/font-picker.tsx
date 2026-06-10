"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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

function getFontOptionId(family: string): string {
  return `font-option-${family.replace(/\s+/g, "-")}`;
}

export function FontPicker({
  value,
  onChange,
  searchPlaceholder,
  noResultsLabel,
}: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonId = useId();
  const listboxId = useId();

  const filteredFonts = useMemo(() => searchTemplateFonts(query), [query]);
  const activeFont = filteredFonts[activeIndex];

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

  useEffect(() => {
    if (!open) {
      setActiveIndex(0);
      return;
    }

    const selectedIndex = filteredFonts.findIndex((font) => font.family === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    inputRef.current?.focus();
  }, [filteredFonts, open, value]);

  useEffect(() => {
    if (!open || !activeFont) {
      return;
    }

    document
      .getElementById(getFontOptionId(activeFont.family))
      ?.scrollIntoView({ block: "nearest" });
  }, [activeFont, activeIndex, open]);

  const handleSelect = (font: TemplateFontOption) => {
    loadGoogleFonts([font.family]);
    onChange(font.family);
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    buttonRef.current?.focus();
  };

  const moveActiveIndex = (direction: 1 | -1) => {
    if (filteredFonts.length === 0) {
      return;
    }

    setActiveIndex((current) => {
      const next = current + direction;
      if (next < 0) {
        return filteredFonts.length - 1;
      }
      if (next >= filteredFonts.length) {
        return 0;
      }
      return next;
    });
  };

  const handleListboxKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveActiveIndex(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveActiveIndex(-1);
        break;
      case "Enter":
        event.preventDefault();
        if (activeFont) {
          handleSelect(activeFont);
        }
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        setQuery("");
        setActiveIndex(0);
        buttonRef.current?.focus();
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className="flex h-8 w-full min-w-0 items-center justify-between gap-1.5 border bg-background px-2.5 text-left text-xs hover:bg-muted/50"
        style={{ fontFamily: value }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setOpen(true);
          }
        }}
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
                ref={inputRef}
                value={query}
                placeholder={searchPlaceholder}
                className="h-8 pl-7 text-sm"
                role="combobox"
                aria-expanded={open}
                aria-controls={listboxId}
                aria-activedescendant={
                  activeFont ? getFontOptionId(activeFont.family) : undefined
                }
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleListboxKeyDown}
              />
            </div>
          </div>
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={buttonId}
            className="max-h-52 overflow-y-auto p-1"
            onKeyDown={handleListboxKeyDown}
          >
            {filteredFonts.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {noResultsLabel}
              </p>
            ) : (
              filteredFonts.map((font, index) => (
                <button
                  key={font.family}
                  id={getFontOptionId(font.family)}
                  type="button"
                  role="option"
                  aria-selected={font.family === value}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted",
                    (font.family === value || index === activeIndex) &&
                      "bg-primary/10",
                  )}
                  style={{ fontFamily: font.family }}
                  onMouseEnter={() => setActiveIndex(index)}
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
