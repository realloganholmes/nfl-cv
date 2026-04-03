import { useEffect, useMemo, useRef, useState } from "react";
import {
  DetectionFrame,
  PlayResults,
  PlaySummary,
  getPlay,
  getPlayResults,
  getVideoUrl,
  listPlays,
  uploadPlay,
} from "./api";

type View = "home" | "upload" | "detail";

const statusStyles: Record<string, string> = {
  queued: "bg-slate-800 text-slate-200",
  processing: "bg-blue-900 text-blue-200",
  done: "bg-emerald-900 text-emerald-200",
  failed: "bg-red-900 text-red-200",
};

const FIELD_SOURCE_WIDTH = 500;
const FIELD_SOURCE_HEIGHT = 1100;
const PLAYER_COLORS = ["#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#a855f7"];

export default function App() {
  const [view, setView] = useState<View>("home");
  const [plays, setPlays] = useState<PlaySummary[]>([]);
  const [selectedPlay, setSelectedPlay] = useState<PlaySummary | null>(null);
  const [results, setResults] = useState<PlayResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [showPlayers, setShowPlayers] = useState(true);
  const [fieldImageReady, setFieldImageReady] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [visibleTrackIds, setVisibleTrackIds] = useState<Set<number>>(new Set());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<HTMLCanvasElement | null>(null);
  const scrubberRef = useRef<HTMLCanvasElement | null>(null);
  const fieldImageRef = useRef<HTMLImageElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  const loadPlays = async () => {
    setIsLoading(true);
    try {
      const data = await listPlays();
      setPlays(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlays();
  }, []);

  useEffect(() => {
    const image = new Image();
    image.src = "/football-field.png";
    image.onload = () => {
      fieldImageRef.current = image;
      setFieldImageReady(true);
    };
  }, []);

  const openPlay = async (playId: string) => {
    setIsLoading(true);
    try {
      const play = await getPlay(playId);
      setSelectedPlay(play);
      setView("detail");
      if (play.status === "done") {
        const data = await getPlayResults(playId);
        setResults(data);
      } else {
        setResults(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const play = await uploadPlay(file);
      setSelectedPlay(play);
      setView("detail");
      await loadPlays();
    } finally {
      setIsLoading(false);
    }
  };

  const frameByIndex = useMemo(() => {
    if (!results) return new Map<number, DetectionFrame>();
    const map = new Map<number, DetectionFrame>();
    results.frames.forEach((frame) => {
      map.set(frame.frame_index, frame);
    });
    return map;
  }, [results]);

  const trackedPlayers = useMemo(() => {
    if (!results) return [];
    const players = new Map<number, { track_id: number; class_id: number; class_name: string }>();
    results.frames.forEach((frame) => {
      frame.detections.forEach((det) => {
        if (typeof det.track_id !== "number") return;
        if (!players.has(det.track_id)) {
          players.set(det.track_id, {
            track_id: det.track_id,
            class_id: det.class_id,
            class_name: det.class_name,
          });
        }
      });
    });
    return Array.from(players.values()).sort((a, b) => a.track_id - b.track_id);
  }, [results]);

  useEffect(() => {
    if (trackedPlayers.length === 0) {
      setVisibleTrackIds(new Set());
      return;
    }
    setVisibleTrackIds(new Set(trackedPlayers.map((player) => player.track_id)));
  }, [trackedPlayers]);

  const drawField = (frame: DetectionFrame | null) => {
    const canvas = fieldRef.current;
    if (!canvas || !results) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const fieldImage = fieldImageRef.current;
    if (!fieldImage) return;
    ctx.drawImage(fieldImage, 16, 16, width - 32, height - 32);

    if (!frame) return;
    ctx.font = "11px sans-serif";
    ctx.textBaseline = "middle";
    frame.detections.forEach((det) => {
      if (!det.field_position) return;
      if (typeof det.track_id === "number" && !visibleTrackIds.has(det.track_id)) return;

      const [fx, fy] = det.field_position;
      const safeX = Math.max(0, Math.min(FIELD_SOURCE_WIDTH, fx));
      const safeY = Math.max(0, Math.min(FIELD_SOURCE_HEIGHT, fy));
      const flippedX = FIELD_SOURCE_WIDTH - safeX;
      const x = (flippedX / FIELD_SOURCE_WIDTH) * (width - 32) + 16;
      const y = (safeY / FIELD_SOURCE_HEIGHT) * (height - 32) + 16;
      const color = PLAYER_COLORS[Math.abs(det.class_id) % PLAYER_COLORS.length];
      const label = det.class_name || String(det.class_id);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 3;
      ctx.strokeText(label, x + 8, y);
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(label, x + 8, y);
    });
  };

  const drawOverlay = (frame: DetectionFrame | null) => {
    const canvas = overlayRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !results) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!frame) return;
    const scaleX = canvas.width / results.video.width;
    const scaleY = canvas.height / results.video.height;
    ctx.font = "12px sans-serif";
    ctx.textBaseline = "bottom";

    frame.detections.forEach((det) => {
      if (!showPlayers) return;
      if (typeof det.track_id === "number" && !visibleTrackIds.has(det.track_id)) return;
      const [x1, y1, x2, y2] = det.bbox;
      const color = PLAYER_COLORS[Math.abs(det.class_id) % PLAYER_COLORS.length];
      const label = det.class_name || String(det.class_id);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 3;
      ctx.strokeText(label, x1 * scaleX, Math.max(12, y1 * scaleY - 6));
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(label, x1 * scaleX, Math.max(12, y1 * scaleY - 6));
    });
  };

  const drawScrubber = () => {
    const canvas = scrubberRef.current;
    if (!canvas || !results) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const total = results.frames.length;
    if (total === 0) return;
    const barWidth = width / total;
    const isPostSnapValue = (value: unknown) =>
      value === true || value === "true" || value === 1;
    results.frames.forEach((frame, idx) => {
      ctx.fillStyle = isPostSnapValue(frame.is_post_snap as unknown) ? "#f97316" : "#1e293b";
      ctx.fillRect(idx * barWidth, 0, Math.max(1, barWidth), height);
    });
  };

  useEffect(() => {
    drawScrubber();
  }, [results]);

  useEffect(() => {
    onTimeUpdate();
  }, [showPlayers, results, visibleTrackIds]);

  useEffect(() => {
    if (fieldImageReady) {
      onTimeUpdate();
    }
  }, [fieldImageReady]);

  useEffect(() => {
    const handleResize = () => {
      onTimeUpdate();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [results, showPlayers, fieldImageReady]);

  const onTimeUpdate = () => {
    if (!results || !videoRef.current) return;
    const frameIndex = Math.floor(videoRef.current.currentTime * results.video.fps);
    const frame = frameByIndex.get(frameIndex) || null;
    drawOverlay(frame);
    drawField(frame);
  };

  const seekToTime = (timeSeconds: number) => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState >= 1) {
      video.currentTime = timeSeconds;
      onTimeUpdate();
    } else {
      pendingSeekRef.current = timeSeconds;
    }
  };

  const onLoadedMetadata = () => {
    if (pendingSeekRef.current !== null && videoRef.current) {
      videoRef.current.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
    }
    onTimeUpdate();
  };

  const seekToScrubberPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!results || !videoRef.current) return;
    const target = event.currentTarget;
    const width = target.clientWidth || target.getBoundingClientRect().width || 1;
    const offsetX = Math.max(0, Math.min(width, event.nativeEvent.offsetX));
    const ratio = offsetX / width;
    const targetFrame = Math.max(
      0,
      Math.min(results.frames.length - 1, Math.floor(ratio * results.frames.length)),
    );
    seekToTime(targetFrame / results.video.fps);
  };

  const onScrubberPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsScrubbing(true);
    seekToScrubberPosition(event);
  };

  const onScrubberPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScrubbing) return;
    seekToScrubberPosition(event);
  };

  const onScrubberPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsScrubbing(false);
  };

  const onGoToSnap = () => {
    if (!results || !videoRef.current) return;
    const isPostSnapValue = (value: unknown) =>
      value === true || value === "true" || value === 1;
    const orderedFrames = [...results.frames].sort(
      (a, b) => a.frame_index - b.frame_index,
    );
    let targetFrame = orderedFrames.length > 0 ? orderedFrames[0].frame_index : 0;
    const firstPostIndex = orderedFrames.findIndex((frame) =>
      isPostSnapValue(frame.is_post_snap as unknown),
    );
    if (firstPostIndex > 0) {
      targetFrame = orderedFrames[firstPostIndex - 1].frame_index;
    } else if (firstPostIndex === -1 && orderedFrames.length > 0) {
      targetFrame = orderedFrames[orderedFrames.length - 1].frame_index;
    }
    seekToTime(targetFrame / results.video.fps);
  };

  const onTogglePlayer = (trackId: number) => {
    setVisibleTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  };

  const onToggleAllPlayers = () => {
    if (trackedPlayers.length === 0) return;
    setVisibleTrackIds((prev) => {
      if (prev.size === trackedPlayers.length) {
        return new Set();
      }
      return new Set(trackedPlayers.map((player) => player.track_id));
    });
  };

  const currentStatus = selectedPlay?.status ?? "queued";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold tracking-wide">NFL CV Local</div>
          <div className="text-sm text-slate-400">Play detection pipeline</div>
        </div>
        <nav className="flex gap-2">
          <button
            className={`px-3 py-2 rounded-md text-sm ${view === "home" ? "bg-slate-800" : "bg-slate-900"
              }`}
            onClick={() => setView("home")}
          >
            Home
          </button>
          <button
            className={`px-3 py-2 rounded-md text-sm ${view === "upload" ? "bg-slate-800" : "bg-slate-900"
              }`}
            onClick={() => setView("upload")}
          >
            Upload
          </button>
        </nav>
      </header>

      <main className="px-6 py-6">
        {view === "home" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Plays</h2>
              <button
                className="px-3 py-2 rounded-md bg-slate-800 text-sm"
                onClick={loadPlays}
                disabled={isLoading}
              >
                Refresh
              </button>
            </div>
            <div className="grid gap-3">
              {plays.length === 0 && (
                <div className="text-slate-400">No plays uploaded yet.</div>
              )}
              {plays.map((play) => (
                <button
                  key={play.id}
                  onClick={() => openPlay(play.id)}
                  className="text-left p-4 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{play.filename}</div>
                      <div className="text-sm text-slate-400">
                        {new Date(play.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${statusStyles[play.status] ?? "bg-slate-800"
                        }`}
                    >
                      {play.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === "upload" && (
          <div className="max-w-xl">
            <h2 className="text-lg font-semibold mb-4">Upload Play</h2>
            <label className="block border border-dashed border-slate-700 rounded-xl p-8 text-center bg-slate-900">
              <div className="text-slate-300 mb-2">Drop video or click to upload</div>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleUpload(file);
                  }
                }}
              />
              <div className="text-xs text-slate-500">MP4 or MOV recommended</div>
            </label>
          </div>
        )}

        {view === "detail" && selectedPlay && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedPlay.filename}</h2>
                <div className="text-sm text-slate-400">Status: {currentStatus}</div>
              </div>
              <button
                className="px-3 py-2 rounded-md bg-slate-800 text-sm"
                onClick={() => openPlay(selectedPlay.id)}
              >
                Reload
              </button>
            </div>

            {currentStatus !== "done" && (
              <div className="text-slate-400">
                Processing in progress. You can leave this page and come back later.
              </div>
            )}

            {currentStatus === "done" && results && (
              <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                    <video
                      ref={videoRef}
                      src={getVideoUrl(selectedPlay.id)}
                      controls
                      className="w-full h-auto"
                      onTimeUpdate={onTimeUpdate}
                      onLoadedMetadata={onLoadedMetadata}
                    />
                    <canvas
                      ref={overlayRef}
                      className="absolute inset-0 pointer-events-none"
                    />
                  </div>
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-3">
                    <div className="text-xs text-slate-400 mb-2">Pre/Post Snap</div>
                    <canvas
                      ref={scrubberRef}
                      width={600}
                      height={16}
                      className="cursor-ew-resize"
                      onPointerDown={onScrubberPointerDown}
                      onPointerMove={onScrubberPointerMove}
                      onPointerUp={onScrubberPointerUp}
                      onPointerLeave={(event) => {
                        if (isScrubbing) {
                          onScrubberPointerUp(event);
                        }
                      }}
                    />
                    <div className="flex gap-4 text-xs text-slate-400 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full bg-slate-800" />
                        Pre-snap
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full bg-orange-500" />
                        Post-snap
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showPlayers}
                        onChange={(event) => setShowPlayers(event.target.checked)}
                      />
                      Show Players
                    </label>
                    <button
                      className="px-3 py-1 rounded-md bg-slate-800 text-sm"
                      onClick={onGoToSnap}
                    >
                      Go to snap
                    </button>
                  </div>
                  {trackedPlayers.length > 0 && (
                    <div className="rounded-lg bg-slate-900 border border-slate-800 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-slate-400">Detected players</div>
                        <button
                          className="text-xs text-slate-300 hover:text-white"
                          onClick={onToggleAllPlayers}
                        >
                          {visibleTrackIds.size === trackedPlayers.length ? "Hide all" : "Show all"}
                        </button>
                      </div>
                      <div className="grid gap-2">
                        {trackedPlayers.map((player) => {
                          const color = PLAYER_COLORS[Math.abs(player.class_id) % PLAYER_COLORS.length];
                          const label = player.class_name || String(player.class_id);
                          return (
                            <label key={player.track_id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={visibleTrackIds.has(player.track_id)}
                                onChange={() => onTogglePlayer(player.track_id)}
                              />
                              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                              {label} #{player.track_id}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="font-medium mb-2">Top-Down View</div>
                  <canvas ref={fieldRef} width={360} height={520} />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
