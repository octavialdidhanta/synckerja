export function showThreadsScheduleRow(_photoPlan: boolean, _imageCount: number): boolean {
  return true;
}

export function threadsPhotoCountNote(imageCount: number): string | null {
  if (imageCount < 1) return "Add at least 1 photo before posting to Threads.";
  if (imageCount > 10) return "Threads accepts at most 10 photos.";
  return null;
}
