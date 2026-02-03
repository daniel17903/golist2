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
        }
      };
    }
  }

  return {
    default: DexieMock,
    Table: class {}
  };
});

const { GoListDatabase } = await import("./db");

describe("GoListDatabase", () => {
  it("initializes schema versions with expected tables", () => {
    const db = new GoListDatabase() as {
      name: string;
      versions: Array<{ number: number; stores: Record<string, string> | null }>;
    };

    expect(db.name).toBe("golist");
    expect(db.versions).toHaveLength(2);
    expect(db.versions[0]?.number).toBe(1);
    expect(db.versions[0]?.stores).toEqual({
      lists: "id, name, updatedAt",
      items: "id, listId, checked, updatedAt"
    });
    expect(db.versions[1]?.number).toBe(2);
    expect(db.versions[1]?.stores).toEqual({
      lists: "id, name, updatedAt",
      items: "id, listId, checked, updatedAt",
      metadata: "id"
    });
  });
});
