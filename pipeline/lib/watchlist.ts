import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import type { Watchlist, WatchlistEntity } from "../types.js";

const ENTITY_TYPES = new Set(["country", "pair", "topic"]);

function isEntity(value: unknown): value is WatchlistEntity {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entity = value as Record<string, unknown>;
  return (
    typeof entity.id === "string" &&
    typeof entity.type === "string" &&
    ENTITY_TYPES.has(entity.type) &&
    typeof entity.gdelt_query === "string" &&
    typeof entity.threshold === "number"
  );
}

export async function loadWatchlist(path: string): Promise<Watchlist> {
  const parsed = parse(await readFile(path, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || !("entities" in parsed)) {
    throw new Error("watchlist.yaml must contain an entities array");
  }

  const entities = (parsed as { entities: unknown }).entities;
  if (!Array.isArray(entities) || !entities.every(isEntity)) {
    throw new Error("watchlist.yaml contains an invalid entity");
  }

  return { entities };
}
