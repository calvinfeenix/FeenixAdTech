"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, X, Loader2, FileImage, FileVideo, FileAudio } from "lucide-react";
import { useToast } from "@/components/toast";
import { assetTypeFromMime, formatBytes } from "@/lib/utils";

/**
 * Captures the first usable video frame as a poster blob (and its duration).
 * Runs entirely client-side so the server never needs ffmpeg.
 */
function captureVideoPoster(file: File): Promise<{ blob: Blob | null; duration: number }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = URL.createObjectURL(file);
    const done = (blob: Blob | null, duration: number) => {
      URL.revokeObjectURL(video.src);
      resolve({ blob, duration });
    };
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext("2d");
      if (!ctx) return done(null, video.duration || 0);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => done(blob, video.duration || 0), "image/webp", 0.8);
    };
    video.onerror = () => done(null, 0);
  });
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = URL.createObjectURL(file);
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(audio.duration || 0);
    };
    audio.onerror = () => resolve(0);
  });
}

export default function AssetUploader({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const type = file ? assetTypeFromMime(file.type) : null;
  const TypeIcon = type === "video" ? FileVideo : type === "audio" ? FileAudio : FileImage;

  function pick(f: File | null) {
    if (!f) return;
    const t = assetTypeFromMime(f.type);
    if (!t || t === "audio") {
      toast("Unsupported file type. Use an image or video.", "error");
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function upload() {
    if (!file || !type) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("title", title || file.name);
      fd.set("tags", tags);

      if (type === "video") {
        const { blob, duration } = await captureVideoPoster(file);
        if (blob) fd.set("poster", new File([blob], "poster.webp", { type: "image/webp" }));
        if (duration) fd.set("duration", String(duration));
      } else if (type === "audio") {
        const duration = await getAudioDuration(file);
        if (duration) fd.set("duration", String(duration));
      }

      const res = await fetch("/api/assets/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");

      toast("Asset uploaded", "success");
      router.refresh();
      onClose();
    } catch (err) {
      toast(String((err as Error).message), "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-display font-semibold text-foreground">Upload asset</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Dropzone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files?.[0] ?? null);
          }}
          className="border border-dashed border-border-strong rounded-xl p-6 text-center cursor-pointer hover:bg-white/5 transition-colors"
        >
          {file ? (
            <div className="flex items-center justify-center gap-3 text-foreground">
              <TypeIcon size={22} className="text-accent" />
              <div className="text-left">
                <p className="text-sm font-medium truncate max-w-[280px]">{file.name}</p>
                <p className="text-xs text-muted">
                  {type} · {formatBytes(file.size)}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-muted">
              <UploadCloud size={28} className="mx-auto mb-2 text-accent" />
              <p className="text-sm">Drop a file here, or click to browse</p>
              <p className="text-xs mt-1">Images and video · up to 100 MB</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="space-y-3 mt-4">
          <label className="block">
            <span className="text-sm font-medium text-muted-strong">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-muted-strong">Tags</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="comma, separated, tags"
              className="mt-1.5 w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted-strong hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={upload}
            disabled={!file || uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-accent hover:bg-accent-hover text-black font-semibold transition-all duration-200 hover:shadow-[0_4px_20px_-4px_var(--accent)] active:scale-95 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}
