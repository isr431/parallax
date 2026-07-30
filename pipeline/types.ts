import type {
  ContextMarker,
  PriceSeries,
  Situation,
  SourceName,
} from "../shared/types.js";

export interface SourceOutput {
  source: SourceName;
  records: number;
  situations?: Situation[];
  context?: ContextMarker[];
  prices?: PriceSeries[];
}

export interface SourceFetcher {
  source: SourceName;
  fetch: () => Promise<SourceOutput>;
}

export interface WatchlistEntity {
  id: string;
  type: "country" | "pair" | "topic";
  gdelt_query: string;
  threshold: number;
  firms_bbox?: [number, number, number, number];
  radar_location?: string;
  fred_series?: string[];
}

export interface Watchlist {
  entities: WatchlistEntity[];
}

