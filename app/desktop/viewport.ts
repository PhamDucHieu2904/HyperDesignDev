const designWidth = 1920;
const designHeight = 1000;

// Fit the established PC layout as one canvas, including its chrome and controls.
// Touch-sized layouts keep their own responsive rules instead of shrinking text.
export function desktopViewport(width: number, height: number, finePointer = false) {
  const availableWidth = Math.max(1, width);
  const availableHeight = Math.max(1, height);
  const desktop = availableWidth > 820 || (finePointer && availableWidth >= 640);
  const scale = desktop ? Math.min(1, availableWidth / designWidth, availableHeight / designHeight) : 1;
  return { desktop, scale, width: availableWidth / scale, height: availableHeight / scale };
}
