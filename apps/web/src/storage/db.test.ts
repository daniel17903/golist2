import { describe, expect, it, vi } from "vitest";

vi.mock("dexie", () => {
  class DexieMock {
    name: string;
    versions: Array<{ number: number; stores: Record<string, string> | null }> = [];

    constructor(name: string) {
      this.name = name;
    }

    version(number: number) {
      return {
        stores: (schema: Record<string, string>) => {
          this.versions.push({ number, stores: schema });
        },
      };
    }
  }

  return {
    default: DexieMock,
    Table: class {},
  };
});

const { GoListDatabase } = await import("./db");

type MockDbInstance = {
  name: string;
  versions: Array<{ number: number; stores: Record<string, string> | null }>;
};

const isMockDbInstance = (value: unknown): value is MockDbInstance => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const name = Reflect.get(value, "name");
  const versions = Reflect.get(value, "versions");

  return typeof name === "string" && Array.isArray(versions);
};

describe("GoListDatabase", () => {
  it("initializes schema versions with expected tables", () => {
    const dbCandidate: unknown = new GoListDatabase();

    expect(isMockDbInstance(dbCandidate)).toBe(true);
    if (!isMockDbInstance(dbCandidate)) {
      throw new Error("Expected mocked db shape");
    }

    const db = dbCandidate;

    expect(db.name).toBe("golist");
    expect(db.versions).toHaveLength(2);
    expect(db.versions[0]?.number).toBe(1);
    expect(db.versions[0]?.stores).toEqual({
      lists: "id, name, updatedAt",
      items: "id, listId, deleted, updatedAt",
    });
    expect(db.versions[1]?.number).toBe(2);
    expect(db.versions[1]?.stores).toEqual({
      lists: "id, name, updatedAt",
      items: "id, listId, deleted, updatedAt",
      metadata: "id",
    });
  });
});
