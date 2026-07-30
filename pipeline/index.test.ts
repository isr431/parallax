import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { PipelineStatus } from "../shared/types.js";
import type { SourceFetcher } from "./types.js";
import { runPipeline } from "./index.js";

test("a failed source does not prevent successful source output", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "parallax-pipeline-"));
  const fetchers: SourceFetcher[] = [
    {
      source: "gdelt",
      async fetch() {
        throw new Error("synthetic failure");
      },
    },
    {
      source: "fred",
      async fetch() {
        return { source: "fred", records: 2 };
      },
    },
  ];

  await runPipeline({
    outputDir,
    fetchers,
    now: new Date("2026-07-31T00:00:00.000Z"),
    watchlistPath: join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "watchlist.yaml",
    ),
  });

  const status = JSON.parse(
    await readFile(join(outputDir, "latest", "status.json"), "utf8"),
  ) as PipelineStatus;

  assert.deepEqual(status.sources, [
    {
      source: "gdelt",
      last_success: null,
      last_error: "synthetic failure",
      records: 0,
    },
    {
      source: "fred",
      last_success: "2026-07-31T00:00:00.000Z",
      last_error: null,
      records: 2,
    },
  ]);
  assert.equal(
    await readFile(join(outputDir, "latest", "situations.json"), "utf8"),
    "[]\n",
  );
});
