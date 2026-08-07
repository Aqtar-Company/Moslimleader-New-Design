// Module-level store for camera-captured files.
// Avoids relying on CustomEvent.detail (which can be unreliable on some mobile browsers).
let _pendingFile: File | null = null;

export function setCameraFile(file: File) { _pendingFile = file; }

export function consumeCameraFile(): File | null {
  const f = _pendingFile;
  _pendingFile = null;
  return f;
}
