import { parseArgs } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  ContextData,
  PricesData,
  Situation,
} from "../shared/types.js";
import type { SourceFetcher } from "./types.js";
import { writeJson } from "./lib/files.js";
import { StatusRecorder } from "./lib/status.js";
import { loadWatchlist } from "./lib/watchlist.js";
import { cloudflareFetcher } from "./sources/cloudflare.js";
import { firmsFetcher } from "./sources/firms.js";
import { fredFetcher } from "./sources/fred.js";
import { gdeltFetcher } from "./sources/gdelt.js";
import { usgsGdacsFetcher } from "./sources/usgs-gdacs.js";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const sourceFetchers: SourceFetcher[] = [
  gdeltFetcher,
  cloudflareFetcher,
  usgsGdacsFetcher,
  firmsFetcher,
  fredFetcher,
];

export interface RunPipelineOptions {
  outputDir: string;
  fetchers?: SourceFetcher[];
  now?: Date;
  watchlistPath?: string;
}

export async function runPipeline({
  outputDir,
  fetchers = sourceFetchers,
  now = new Date(),
  watchlistPath = join(repositoryRoot, "watchlist.yaml"),
}: RunPipelineOptions): Promise<void> {
  const watchlist = await loadWatchlist(watchlistPath);
  const latestDir = join(outputDir, "latest");
  const generatedAt = now.toISOString();
  const status = await StatusRecorder.from(join(latestDir, "status.json"));
  const situations: Situation[] = [];
  const context: ContextData = { generated_at: generatedAt, markers: [] };
  const prices: PricesData = { generated_at: generatedAt, series: [] };

  console.log(`watchlist: ${watchlist.entities.length} entities`);

  for (const fetcher of fetchers) {
    try {
      const output = await fetcher.fetch();
      situations.push(...(output.situations ?? []));
      context.markers.push(...(output.context ?? []));
      prices.series.push(...(output.prices ?? []));
      status.success(fetcher.source, output.records, generatedAt);
      console.log(`${fetcher.source}: ${output.records} placeholder records`);
    } catch (error) {
      status.failure(fetcher.source, error);
      console.error(
        `${fetcher.source}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  await Promise.all([
    writeJson(join(latestDir, "situations.json"), situations),
    writeJson(join(latestDir, "context.json"), context),
    writeJson(join(latestDir, "prices.json"), prices),
    status.write(generatedAt),
  ]);
}

function outputDirectoryFromArguments(): string {
  const { values } = parseArgs({
    options: {
      "output-dir": { type: "string", default: "generated-data" },
    },
  });

  return resolve(repositoryRoot, values["output-dir"]);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await runPipeline({ outputDir: outputDirectoryFromArguments() });
}
