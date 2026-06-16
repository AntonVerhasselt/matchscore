"use client";

import { FootballTeamAvatar } from "@/components/football/FootballTeamAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export type FootballTeamSearchResult = {
  _id: Id<"footballTeams">;
  name: string;
  vibTeamName: string;
  stamnummer?: string;
  competitionPath?: string;
  sourceCompetitionId?: number;
  logoStorageId?: Id<"_storage">;
  logoUrl: string | null;
};

const DEBOUNCE_MS = 300;
const VISIBLE_ROWS = 5;
const ROW_HEIGHT_REM = 3.25;

type FootballTeamSearchProps = {
  variant?: "hero" | "default";
  value: Id<"footballTeams"> | null;
  selectedTeam: FootballTeamSearchResult | null;
  onChange: (
    teamId: Id<"footballTeams"> | null,
    team: FootballTeamSearchResult | null,
  ) => void;
  onSelect?: (team: FootballTeamSearchResult) => void;
  inputId?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
};

export function FootballTeamSearch({
  variant = "default",
  value,
  selectedTeam,
  onChange,
  onSelect,
  inputId,
  label,
  placeholder,
  disabled = false,
  autoFocus = false,
}: FootballTeamSearchProps) {
  const t = useTranslations("footballSearch");
  const generatedId = useId();
  const resolvedInputId = inputId ?? generatedId;
  const listboxId = `${resolvedInputId}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const isHero = variant === "hero";
  const trimmedQuery = query.trim();
  const trimmedDebouncedQuery = debouncedQuery.trim();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const searchResults = useQuery(
    api.football.queries.searchFootballTeams,
    trimmedDebouncedQuery.length >= 2 ? { query: trimmedDebouncedQuery } : "skip",
  );

  const isSearching =
    trimmedDebouncedQuery.length >= 2 && searchResults === undefined;
  const hasQuery = trimmedDebouncedQuery.length >= 2;
  const showDropdown =
    isOpen &&
    !value &&
    hasQuery &&
    (isSearching || (searchResults !== undefined && searchResults.length > 0));

  const showNoResults =
    isOpen && hasQuery && !isSearching && searchResults?.length === 0;

  const showFloatingPanel = showDropdown || showNoResults;

  const updateDropdownPosition = useCallback(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!showFloatingPanel) {
      setDropdownPosition(null);
      return;
    }

    updateDropdownPosition();
    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);

    return () => {
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
    };
  }, [showFloatingPanel, updateDropdownPosition]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) {
        return;
      }
      if (dropdownRef.current?.contains(target)) {
        return;
      }
      closeDropdown();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [closeDropdown]);

  const selectTeam = useCallback(
    (team: FootballTeamSearchResult) => {
      if (onSelect) {
        onSelect(team);
        return;
      }
      onChange(team._id, team);
      setQuery(team.name);
      closeDropdown();
    },
    [closeDropdown, onChange, onSelect],
  );

  const clearSelection = useCallback(() => {
    onChange(null, null);
    setQuery("");
    setDebouncedQuery("");
    closeDropdown();
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [closeDropdown, onChange]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || !searchResults?.length) {
      if (event.key === "Escape") {
        closeDropdown();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current >= searchResults.length - 1 ? 0 : current + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current <= 0 ? searchResults.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      const team = searchResults[highlightedIndex];
      if (team) {
        selectTeam(team);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
    }
  };

  useEffect(() => {
    if (!showDropdown) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex(searchResults?.length ? 0 : -1);
  }, [searchResults, showDropdown, trimmedDebouncedQuery]);

  const floatingPanel =
    dropdownPosition && showFloatingPanel ? (
      <div
        ref={dropdownRef}
        className={cn(
          "fixed z-50 overflow-hidden border bg-popover text-popover-foreground shadow-xl",
          isHero ? "border-primary-foreground/15" : "rounded-md",
          showNoResults && "px-4 py-3 text-sm text-muted-foreground",
        )}
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width,
        }}
        role={showNoResults ? "status" : undefined}
      >
        {showDropdown ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={t("resultsLabel")}
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: `calc(${ROW_HEIGHT_REM}rem * ${VISIBLE_ROWS})` }}
          >
            {isSearching ? (
              <li className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t("searching")}
              </li>
            ) : (
              searchResults?.map((team, index) => (
                <li key={team._id} role="presentation">
                  <button
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={highlightedIndex === index}
                    className={cn(
                      "flex h-[3.25rem] w-full items-center gap-3 px-4 text-left transition-colors",
                      highlightedIndex === index
                        ? "bg-muted"
                        : "hover:bg-muted/80",
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectTeam(team)}
                  >
                    <FootballTeamAvatar
                      name={team.name}
                      logoUrl={team.logoUrl}
                      size="default"
                    />
                    <span className="min-w-0 truncate text-sm font-medium sm:text-base">
                      {team.name}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : (
          t("noResults")
        )}
      </div>
    ) : null;

  if (value && selectedTeam) {
    return (
      <div className="space-y-2">
        {label ? (
          <Label htmlFor={resolvedInputId} className={isHero ? "sr-only" : undefined}>
            {label}
          </Label>
        ) : null}
        <div
          className={cn(
            "flex items-center gap-3 border",
            isHero
              ? "h-12 border-sidebar-foreground/25 bg-sidebar-foreground px-4 text-sidebar shadow-lg sm:h-14"
              : "rounded-md bg-background px-3 py-2.5",
          )}
        >
          <FootballTeamAvatar
            name={selectedTeam.name}
            logoUrl={selectedTeam.logoUrl}
            size="default"
            className={isHero ? "size-9 sm:size-10" : undefined}
          />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate font-heading uppercase tracking-tight",
                isHero
                  ? "text-base font-bold text-sidebar sm:text-lg"
                  : "text-sm font-bold",
              )}
            >
              {selectedTeam.name}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={clearSelection}
            disabled={disabled}
            aria-label={t("clearSelection")}
            className={cn(
              "shrink-0",
              isHero && "text-sidebar/60 hover:text-sidebar",
            )}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      {label ? (
        <Label htmlFor={resolvedInputId} className={isHero ? "sr-only" : undefined}>
          {label}
        </Label>
      ) : null}

      <div className="relative">
        <Search
          className={cn(
            "pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2",
            isHero ? "text-sidebar/55" : "text-muted-foreground",
          )}
          aria-hidden
        />
        <Input
          ref={inputRef}
          id={resolvedInputId}
          type="search"
          value={query}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder ?? t("placeholder")}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0
              ? `${listboxId}-option-${highlightedIndex}`
              : undefined
          }
          enterKeyHint="search"
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(null, null);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (trimmedQuery.length >= 2) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full pl-11 text-base",
            isHero &&
              "h-12 border-sidebar-foreground/25 bg-sidebar-foreground font-bold text-sidebar shadow-lg placeholder:text-sidebar/55 focus-visible:border-sidebar-primary focus-visible:ring-sidebar-primary/30 dark:bg-sidebar-foreground sm:h-14",
          )}
        />
      </div>

      {typeof document !== "undefined" && floatingPanel
        ? createPortal(floatingPanel, document.body)
        : null}
    </div>
  );
}
