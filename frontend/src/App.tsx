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

export default function App() {
  const [view, setView] = useState<View>("home");
  const [plays, setPlays] = useState<PlaySummary[]>([]);
  const [selectedPlay, setSelectedPlay] = useState<PlaySummary | null>(null);
  const [results, setResults] = useState<PlayResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [showPlayers, setShowPlayers] = useState(true);
  const [fieldImageReady, setFieldImageReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const fieldRef = useRef<HTMLCanvasElement | null>(null);
  const scrubberRef = useRef<HTMLCanvasElement | null>(null);
  const fieldImageRef = useRef<HTMLImageElement | null>(null);

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
    frame.detections.forEach((det) => {
      if (!det.field_position) return;
      if (!showPlayers) return;

      const [fx, fy] = det.field_position;
      const safeX = Math.max(0, Math.min(FIELD_SOURCE_WIDTH, fx));
      const safeY = Math.max(0, Math.min(FIELD_SOURCE_HEIGHT, fy));
      const flippedX = FIELD_SOURCE_WIDTH - safeX;
      const x = (flippedX / FIELD_SOURCE_WIDTH) * (width - 32) + 16;
      const y = (safeY / FIELD_SOURCE_HEIGHT) * (height - 32) + 16;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
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

    frame.detections.forEach((det) => {
      if (!showPlayers) return;
      const [x1, y1, x2, y2] = det.bbox;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
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
    results.frames.forEach((frame, idx) => {
      ctx.fillStyle = frame.is_post_snap ? "#f97316" : "#1e293b";
      ctx.fillRect(idx * barWidth, 0, Math.max(1, barWidth), height);
    });
  };

  useEffect(() => {
    drawScrubber();
  }, [results]);

  useEffect(() => {
    onTimeUpdate();
  }, [showPlayers, results]);

  useEffect(() => {
    if (fieldImageReady) {
      onTimeUpdate();
    }
  }, [fieldImageReady]);

  const onTimeUpdate = () => {
    if (!results || !videoRef.current) return;
    const frameIndex = Math.floor(videoRef.current.currentTime * results.video.fps);
    const frame = frameByIndex.get(frameIndex) || null;
    drawOverlay(frame);
    drawField(frame);
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
                      onLoadedMetadata={onTimeUpdate}
                    />
                    <canvas
                      ref={overlayRef}
                      className="absolute inset-0 pointer-events-none"
                    />
                  </div>
                  <div className="rounded-lg bg-slate-900 border border-slate-800 p-3">
                    <div className="text-xs text-slate-400 mb-2">Pre/Post Snap</div>
                    <canvas ref={scrubberRef} width={600} height={16} />
                  </div>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showPlayers}
                        onChange={(event) => setShowPlayers(event.target.checked)}
                      />
                      Players
                    </label>
                  </div>
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
