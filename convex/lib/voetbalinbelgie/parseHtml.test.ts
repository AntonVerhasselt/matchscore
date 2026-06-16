import { describe, expect, test } from "vitest";

import {
  parseClubTeamsFromHtml,
  parseSportsClubJsonLd,
  parseStamnummersHtml,
} from "./parseHtml";

const stamnummersSnippet = `
<dt class="col-sm-4">Stamnummer 7302</dt>
<dd class="col-sm-8"><a href="/clubs/a/aartselaar-ksv/">link</a>&nbsp;<a href="/clubs/a/aartselaar-ksv/">Aartselaar KSV</a></dd>
`;

const aartselaarSnippet = `
<body class="antwerpen clubs club-detail">
<script type="application/ld+json">{
  "@graph": [{
    "@type": "SportsClub",
    "name": "KSV Aartselaar",
    "branchCode": "7302",
    "logo": "https://www.voetbalinbelgie.be/images/club_logo.png",
    "address": {
      "streetAddress": "Kleistraat 204",
      "postalCode": "2630",
      "addressLocality": "Aartselaar",
      "addressRegion": "Antwerpen",
      "addressCountry": "BE"
    }
  }]
}</script>
<a href="#comp-389">Mannen</a>
<div id="comp-389">
  <a href="/competities/2025-2026/antwerpen/mannen/2a/">2a</a>
  <td class="club"><img src="/images/aartselaar-ksv.png" alt="Clublogo voetbalvereniging KSV Aartselaar">&nbsp;<a href="#">KSV Aartselaar</a></td>
</div>
<a href="#comp-394">Mannen B</a>
<div id="comp-394">
  <a href="/competities/2025-2026/antwerpen/mannen/4a/">4a</a>
  <td class="club"><img src="/images/aartselaar-ksv.png" alt="Clublogo voetbalvereniging KSV Aartselaar B">&nbsp;<a href="#">KSV Aartselaar B</a></td>
</div>
`;

const jsonLdOnlySnippet = `
<script type="application/ld+json">{
  "@graph": [{
    "@type": "SportsClub",
    "name": "Inactive FC",
    "branchCode": "9999"
  }]
}</script>
`;

const brasschaatSnippet = `
<script type="application/ld+json">{
  "@graph": [{
    "@type": "SportsClub",
    "name": "KFC Brasschaat",
    "branchCode": "228"
  }]
}</script>
<div id="comp-389">
  <a href="/competities/2025-2026/antwerpen/mannen/2a/">2a</a>
  <td class="club"><img src="/images/brasschaat-kfc.png" alt="Clublogo voetbalvereniging KFC Brasschaat">&nbsp;<a href="#">KFC Brasschaat</a></td>
</div>
`;

describe("parseHtml", () => {
  test("parseStamnummersHtml extracts stamnummer entries", () => {
    const entries = parseStamnummersHtml(stamnummersSnippet);
    expect(entries).toEqual([
      {
        stamnummer: "7302",
        slugPath: "/clubs/a/aartselaar-ksv/",
        displayName: "Aartselaar KSV",
      },
    ]);
  });

  test("parseSportsClubJsonLd extracts club metadata", () => {
    const club = parseSportsClubJsonLd(aartselaarSnippet);
    expect(club?.name).toBe("KSV Aartselaar");
    expect(club?.branchCode).toBe("7302");
    expect(club?.address?.city).toBe("Aartselaar");
  });

  test("parseClubTeamsFromHtml extracts multiple team tabs", () => {
    const teams = parseClubTeamsFromHtml(aartselaarSnippet, "aartselaar-ksv");
    expect(teams).toHaveLength(2);
    expect(teams[0]).toMatchObject({
      tabLabel: "Mannen",
      sourceCompetitionId: 389,
      competitionPath: "/competities/2025-2026/antwerpen/mannen/2a/",
      teamName: "KSV Aartselaar",
      stamnummer: "7302",
    });
    expect(teams[1]?.teamName).toBe("KSV Aartselaar B");
  });

  test("parseClubTeamsFromHtml falls back to JSON-LD when no tabs exist", () => {
    const teams = parseClubTeamsFromHtml(jsonLdOnlySnippet, "inactive-fc");
    expect(teams).toEqual([
      {
        teamName: "Inactive FC",
        stamnummer: "9999",
      },
    ]);
  });

  test("parseClubTeamsFromHtml parses embedded panels without tab links", () => {
    const teams = parseClubTeamsFromHtml(brasschaatSnippet, "brasschaat-kfc");
    expect(teams).toEqual([
      {
        sourceCompetitionId: 389,
        competitionPath: "/competities/2025-2026/antwerpen/mannen/2a/",
        teamName: "KFC Brasschaat",
        stamnummer: "228",
      },
    ]);
  });
});
