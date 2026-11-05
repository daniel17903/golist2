import { describe, expect, it } from "vitest";
import type { List } from "@golist/shared/domain/types";
import { parseListLastUsedAt, sortListsByLastUsed } from "./listRecency";

const list = (id: string, createdAt: number): List => ({ id, name: id, createdAt, updatedAt: createdAt });

describe("sortListsByLastUsed", () => {
  it("puts the most recently used list first", () => {
    const lists = [list("a", 1), list("b", 2), list("c", 3)];
    expect(sortListsByLastUsed(lists, { a: 30, b: 10, c: 20 }).map((entry) => entry.id)).toEqual(["a", "c", "b"]);
  });

  it("treats never-used lists as used at creation", () => {
    const lists = [list("old", 1), list("used", 2), list("new", 50)];
    expect(sortListsByLastUsed(lists, { used: 40 }).map((entry) => entry.id)).toEqual(["new", "used", "old"]);
  });

  it("does not mutate the input", () => {
    const lists = [list("a", 1), list("b", 2)];
    sortListsByLastUsed(lists, { a: 5 });
    expect(lists.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});

describe("parseListLastUsedAt", () => {
  it("keeps numeric entries and drops the rest", () => {
    expect(parseListLastUsedAt('{"a":1,"b":"x","c":null}')).toEqual({ a: 1 });
  });

  it("returns an empty map for missing or malformed values", () => {
    expect(parseListLastUsedAt(null)).toEqual({});
    expect(parseListLastUsedAt("not json")).toEqual({});
    expect(parseListLastUsedAt("[1,2]")).toEqual({});
  });
});
