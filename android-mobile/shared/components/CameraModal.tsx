/** Desktop/web build: camera capture not wired; modal is a no-op shell if opened. */
export function CameraModal(_props: {
  /** Callers use either name; the shell ignores both. */
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onCapture: (capture: File) => void;
  title?: string;
  facingMode?: string;
  overlayClassName?: string;
  contentClassName?: string;
}) {
  return null;
}
