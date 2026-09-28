(function (root) {
  'use strict';
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const ease = t => (1 - Math.cos(Math.PI * clamp(t))) / 2;
  // The first segment starts exactly at the spine. Each following segment
  // starts at the previous outer edge, so bending never detaches the hinge.
  function paperPose(width, count, progress, forward) {
    const p = clamp(progress), segmentWidth = width / count;
    const bow = 0.48 * Math.sin(Math.PI * p);
    const result = [];
    let x = forward ? width : 0, z = 0;
    for (let k = 0; k < count; k++) {
      const distance = (k + 0.5) / count;
      const angle = Math.PI * p + bow * (distance * distance - 0.28);
      const column = forward ? count - 1 - k : k;
      result.push({ column, x: forward ? x - segmentWidth : x, z,
        degrees: angle * 180 / Math.PI * (forward ? 1 : -1),
        shade: Math.max(0, Math.sin(angle)) * 0.16,
        edgeX: x, edgeZ: z });
      x += (forward ? -1 : 1) * segmentWidth * Math.cos(angle);
      z += segmentWidth * Math.sin(angle);
    }
    return result;
  }
  const api = { clamp, ease, paperPose };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BookMotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
