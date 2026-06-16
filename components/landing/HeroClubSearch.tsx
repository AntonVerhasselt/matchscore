"use client";

import {
  FootballTeamSearch,
  type FootballTeamSearchResult,
} from "@/components/football/FootballTeamSearch";
import { storeSelectedFootballTeamId } from "@/lib/football/selected-team-storage";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function HeroClubSearch() {
  const t = useTranslations("landing.hero");
  const router = useRouter();

  const handleSelect = (team: FootballTeamSearchResult) => {
    storeSelectedFootballTeamId(team._id);
    router.push("/sign-in");
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <FootballTeamSearch
        variant="hero"
        value={null}
        selectedTeam={null}
        onChange={() => {}}
        onSelect={handleSelect}
        placeholder={t("searchPlaceholder")}
      />
    </div>
  );
}
