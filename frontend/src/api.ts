export type PlayStatus = "queued" | "processing" | "done" | "failed";

export interface PlaySummary {
  id: string;
  filename: string;
  status: PlayStatus;
  created_at: string;
  updated_at: string;
  progress: number;
  video_path?: string;
  results_path?: string | null;
  error_message?: string | null;
}

export interface DetectionFrame {
  frame_index: number;
  timestamp_ms: number;
  detections: Array<{
    bbox: [number, number, number, number];
    track_id?: number;
    class_id: number;
    class_name: string;
    confidence: number;
    field_position?: [number, number] | null;
  }>;
  snap_score?: number | null;
  is_post_snap: boolean;
}

export interface PlayResults {
  video: {
    fps: number;
    frame_count: number;
    width: number;
    height: number;
  };
  field: {
    width: number;
    height: number;
  };
  frames: DetectionFrame[];
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function listPlays(): Promise<PlaySummary[]> {
  const res = await fetch(`${API_URL}/plays`);
  if (!res.ok) {
    throw new Error("Failed to load plays.");
  }
  return res.json();
}

export async function uploadPlay(file: File): Promise<PlaySummary> {
  const data = new FormData();
  data.append("file", file);
  const res = await fetch(`${API_URL}/plays`, { method: "POST", body: data });
  if (!res.ok) {
    throw new Error("Upload failed.");
  }
  return res.json();
}

export async function getPlay(playId: string): Promise<PlaySummary> {
  const res = await fetch(`${API_URL}/plays/${playId}`);
  if (!res.ok) {
    throw new Error("Play not found.");
  }
  return res.json();
}

export async function getPlayResults(playId: string): Promise<PlayResults> {
  const res = await fetch(`${API_URL}/plays/${playId}/results`);
  if (!res.ok) {
    throw new Error("Results not available.");
  }
  return res.json();
}

export function getVideoUrl(playId: string): string {
  return `${API_URL}/plays/${playId}/video`;
}
