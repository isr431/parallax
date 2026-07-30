import type { SourceFetcher } from "../types.js";
import type { SourceName } from "../../shared/types.js";

export function createStubFetcher(
  source: SourceName,
  records: number,
): SourceFetcher {
  return {
    source,
    async fetch() {
      if (process.env.PARALLAX_FAIL_SOURCE === source) {
        throw new Error(`Intentional ${source} stub failure`);
      }

      return { source, records };
    },
  };
}

