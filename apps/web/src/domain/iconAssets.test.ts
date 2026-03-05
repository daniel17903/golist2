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
});
