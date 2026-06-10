"use node";

/* eslint-disable react-hooks/rules-of-hooks -- FontLibrary.use is skia-canvas, not React */

import { access, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { FontLibrary } from "skia-canvas";

import { getFontUrlsForFamilies } from "../../../lib/template-scene/server-font-registry";

const FONT_CACHE_DIR = path.join(os.tmpdir(), "matchscore-template-fonts");

const registeredFamilies = new Set<string>();

function slugifyFamily(family: string): string {
  return family.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

async function materializeFontFamily(
  family: string,
  urls: string[],
): Promise<string[]> {
  const familyDir = path.join(FONT_CACHE_DIR, slugifyFamily(family));
  await mkdir(familyDir, { recursive: true });

  const filePaths: string[] = [];
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index]!;
    const filePath = path.join(familyDir, `${String(index).padStart(2, "0")}.woff2`);

    try {
      await access(filePath);
    } catch {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to download font ${family} from ${url}: ${response.status}`,
        );
      }
      await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    }

    filePaths.push(filePath);
  }

  return filePaths;
}

export async function registerSceneFonts(families: string[]): Promise<void> {
  for (const { family, urls } of getFontUrlsForFamilies(families)) {
    if (registeredFamilies.has(family) || urls.length === 0) {
      continue;
    }

    const filePaths = await materializeFontFamily(family, urls);
    FontLibrary.use(family, filePaths);
    registeredFamilies.add(family);
  }
}

export function resetRegisteredSceneFontsForTests(): void {
  registeredFamilies.clear();
  FontLibrary.reset();
}
