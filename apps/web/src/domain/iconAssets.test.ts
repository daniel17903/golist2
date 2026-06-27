import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { categoryEntriesByLanguage } from "@golist/shared/domain/item-category-mapping";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const webRootDir = path.resolve(currentDir, "../../");
const sourceDir = path.join(webRootDir, "src");
const iconsDir = path.join(webRootDir, "public/icons");

const iconReferencePattern = /(?:"|'|`)\/icons\/([a-zA-Z0-9_-]+)\.svg(?:"|'|`)/g;

const listSourceFiles = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  entries.forEach((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      return;
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  });

  return files;
};

const collectDirectSvgReferences = (): string[] => {
  const references = new Set<string>();

  listSourceFiles(sourceDir).forEach((filePath) => {
    const content = readFileSync(filePath, "utf8");

    for (const match of content.matchAll(iconReferencePattern)) {
      references.add(match[1]);
    }
  });

  return [...references];
};

// Mirrors normalizeNameForMatching in
// packages/shared/src/domain/item-category-mapping.ts so the test detects the
// same collisions the runtime resolver would see.
const normalizeNameForMatching = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ");

const collectItemIconNames = (): string[] => {
  const names = new Set<string>(["default"]);

  Object.values(categoryEntriesByLanguage).forEach((entries) => {
    entries.forEach((entry) => {
      names.add(entry.assetFileName);
    });
  });

  collectDirectSvgReferences().forEach((name) => names.add(name));

  return [...names];
};

describe("item icons", () => {
  it("ensures every referenced SVG icon exists in public/icons", () => {
    const missingIcons = collectItemIconNames().filter(
      (iconName) => !existsSync(path.join(iconsDir, `${iconName}.svg`)),
    );

    expect(missingIcons).toEqual([]);
  });

  // A matching name listed in two entries with different icons (or categories)
  // is a bug: the resolver silently picks one and the other never wins, so the
  // intended icon is dead. This guards against reintroducing such collisions.
  it("maps each item name to exactly one icon and category per language", () => {
    const conflicts: string[] = [];

    Object.entries(categoryEntriesByLanguage).forEach(([language, entries]) => {
      const byName = new Map<string, { icons: Set<string>; categories: Set<string> }>();

      entries.forEach((entry) => {
        entry.matchingNames.forEach((rawName) => {
          const name = normalizeNameForMatching(rawName);
          if (!name) {
            return;
          }

          const bucket = byName.get(name) ?? { icons: new Set<string>(), categories: new Set<string>() };
          bucket.icons.add(entry.assetFileName);
          bucket.categories.add(entry.category);
          byName.set(name, bucket);
        });
      });

      byName.forEach((bucket, name) => {
        if (bucket.icons.size > 1 || bucket.categories.size > 1) {
          conflicts.push(
            `[${language}] "${name}" -> icons: {${[...bucket.icons].join(", ")}}, ` +
              `categories: {${[...bucket.categories].join(", ")}}`,
          );
        }
      });
    });

    expect(conflicts).toEqual([]);
  });
});
