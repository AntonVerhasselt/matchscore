export const LINE_VERTEX_COUNT = 2;

export type LineDashPreset = "solid" | "dashed" | "dotted";

export const LINE_DASH_PRESETS: Record<LineDashPreset, number[] | undefined> = {
  solid: undefined,
  dashed: [16, 10],
  dotted: [2, 10],
};

export function getLineDashPreset(dash: unknown): LineDashPreset {
  if (!Array.isArray(dash) || dash.length === 0) {
    return "solid";
  }

  const serialized = dash.join(",");
  if (serialized === "16,10") {
    return "dashed";
  }
  if (serialized === "2,10") {
    return "dotted";
  }

  return "solid";
}

/** Ensures exactly two vertices (four numbers) in local coordinates. */
export function normalizeLinePoints(points: unknown): number[] {
  if (!Array.isArray(points)) {
    return [0, 0, 240, 0];
  }

  const numeric = points.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );

  if (numeric.length >= 6) {
    const [x0, y0] = numeric;
    const tailX = numeric[numeric.length - 2];
    const tailY = numeric[numeric.length - 1];
    return [
      Math.round(x0),
      Math.round(y0),
      Math.round(tailX),
      Math.round(tailY),
    ];
  }

  if (numeric.length >= 4) {
    return numeric.slice(0, 4).map((value) => Math.round(value));
  }

  return [0, 0, 240, 0];
}

export function getLineVertexPositions(
  baseX: number,
  baseY: number,
  points: number[],
): Array<{ x: number; y: number }> {
  const normalized = normalizeLinePoints(points);
  return [0, 1].map((index) => ({
    x: baseX + normalized[index * 2],
    y: baseY + normalized[index * 2 + 1],
  }));
}

export function updateLineVertex(
  points: number[],
  vertexIndex: number,
  baseX: number,
  baseY: number,
  absoluteX: number,
  absoluteY: number,
): number[] {
  const normalized = [...normalizeLinePoints(points)];
  normalized[vertexIndex * 2] = Math.round(absoluteX - baseX);
  normalized[vertexIndex * 2 + 1] = Math.round(absoluteY - baseY);
  return normalized;
}
