'use strict';

// Electron workArea coordinates are already DIP; applying scaleFactor again
// would make the window exceed monitors using display scaling.
function windowBounds(workArea = {}) {
  const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  const width = positive(workArea.width, 1280), height = positive(workArea.height, 800);
  const left = Number.isFinite(workArea.x) ? Math.floor(workArea.x) : 0, top = Number.isFinite(workArea.y) ? Math.floor(workArea.y) : 0;
  const marginX = Math.min(20, Math.floor(width * .02)), marginY = Math.min(20, Math.floor(height * .02));
  const availableWidth = Math.max(1, width - marginX * 2), availableHeight = Math.max(1, height - marginY * 2);
  const result = { width: Math.min(1560, availableWidth), height: Math.min(1000, availableHeight), minWidth: Math.min(900, availableWidth), minHeight: Math.min(600, availableHeight) };
  return { ...result, x: left + Math.floor((width - result.width) / 2), y: top + Math.floor((height - result.height) / 2) };
}
module.exports = { windowBounds };
