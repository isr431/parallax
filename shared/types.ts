export type SituationStatus = "open" | "decaying" | "closed";
export type EvidenceLayerState =
  | "strong"
  | "not_applicable"
  | "none"
  | "present"
  | "moved";
export type ConfidenceRating =
  | "divergence"
  | "strong"
  | "solid"
  | "reported-only"
  | "unconfirmed";

export interface Evidence {
  source: string;
  url?: string;
  timestamp: string;
  label: string;
  [key: string]: unknown;
}

export interface CoveragePoint {
  date: string;
  ratio: number;
  volume?: number;
  tone?: number;
}

export interface Situation {
  id: string;
  watchlist_ref: string;
  name: string;
  opened: string;
  last_active: string;
  status: SituationStatus;
  coverage: {
    current_ratio: number;
    baseline: number;
    timeline_90d: CoveragePoint[];
  };
  layers: {
    reported: {
      state: "strong";
      evidence: Evidence[];
    };
    observed: {
      state: "not_applicable" | "none" | "present";
      evidence: Evidence[];
    };
    priced: {
      state: "not_applicable" | "none" | "moved";
      evidence: Evidence[];
    };
  };
  confidence: {
    rating: ConfidenceRating;
    explanation: string;
  };
  summary: string;
}

export type ContextKind = "gdelt_hotspot" | "earthquake" | "gdacs_alert";

export interface ContextMarker {
  id: string;
  kind: ContextKind;
  coordinates: [longitude: number, latitude: number];
  label: string;
  timestamp: string;
  source: string;
  url?: string;
}

export interface ContextData {
  generated_at: string;
  markers: ContextMarker[];
}

export type SourceName =
  | "gdelt"
  | "cloudflare"
  | "usgs-gdacs"
  | "firms"
  | "fred";

export interface SourceStatus {
  source: SourceName;
  last_success: string | null;
  last_error: string | null;
  records: number;
}

export interface PipelineStatus {
  generated_at: string;
  sources: SourceStatus[];
}

export interface PricePoint {
  date: string;
  value: number | null;
}

export interface PriceSeries {
  series_id: string;
  label: string;
  observations: PricePoint[];
}

export interface PricesData {
  generated_at: string;
  series: PriceSeries[];
}

