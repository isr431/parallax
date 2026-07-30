import type {
  PipelineStatus,
  SourceName,
  SourceStatus,
} from "../../shared/types.js";
import { readJson, writeJson } from "./files.js";

export class StatusRecorder {
  readonly #path: string;
  readonly #previousBySource: Map<SourceName, SourceStatus>;
  readonly #current: SourceStatus[] = [];

  private constructor(path: string, previous: PipelineStatus | null) {
    this.#path = path;
    this.#previousBySource = new Map(
      previous?.sources.map((status) => [status.source, status]) ?? [],
    );
  }

  static async from(path: string): Promise<StatusRecorder> {
    return new StatusRecorder(path, await readJson<PipelineStatus>(path));
  }

  success(source: SourceName, records: number, timestamp: string): void {
    this.#current.push({
      source,
      last_success: timestamp,
      last_error: null,
      records,
    });
  }

  failure(source: SourceName, error: unknown): void {
    const previous = this.#previousBySource.get(source);
    this.#current.push({
      source,
      last_success: previous?.last_success ?? null,
      last_error: error instanceof Error ? error.message : String(error),
      records: previous?.records ?? 0,
    });
  }

  async write(generatedAt: string): Promise<void> {
    await writeJson(this.#path, {
      generated_at: generatedAt,
      sources: this.#current,
    } satisfies PipelineStatus);
  }
}

