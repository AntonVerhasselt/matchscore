"use client";

import type Konva from "konva";
import { Circle as KonvaCircle } from "react-konva";

import {
  getLineVertexPositions,
  normalizeLinePoints,
  updateLineVertex,
  type SceneNode,
  type SceneNodeAttrs,
} from "@/lib/template-scene";

type LinePointHandlesProps = {
  node: SceneNode;
  scale: number;
  onPointChange: (attrs: SceneNodeAttrs, options?: { recordHistory?: boolean }) => void;
};

function numberAttr(attrs: SceneNodeAttrs, key: string, fallback: number): number {
  const value = attrs[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function LinePointHandles({
  node,
  scale,
  onPointChange,
}: LinePointHandlesProps) {
  const baseX = numberAttr(node.attrs, "x", 0);
  const baseY = numberAttr(node.attrs, "y", 0);
  const points = normalizeLinePoints(node.attrs.points);
  const vertices = getLineVertexPositions(baseX, baseY, points);
  const handleRadius = Math.max(6 / scale, 4);

  const handleDragMove = (vertexIndex: number, konvaNode: Konva.Node) => {
    onPointChange(
      {
        points: updateLineVertex(
          points,
          vertexIndex,
          baseX,
          baseY,
          konvaNode.x(),
          konvaNode.y(),
        ),
      },
      { recordHistory: false },
    );
  };

  const handleDragEnd = (vertexIndex: number, konvaNode: Konva.Node) => {
    onPointChange(
      {
        points: updateLineVertex(
          points,
          vertexIndex,
          baseX,
          baseY,
          konvaNode.x(),
          konvaNode.y(),
        ),
      },
      { recordHistory: true },
    );
  };

  return (
    <>
      {vertices.map((vertex, index) => (
        <KonvaCircle
          key={`${node.attrs.id as string}-vertex-${index}`}
          x={vertex.x}
          y={vertex.y}
          radius={handleRadius}
          fill="#ffffff"
          stroke="#7c3aed"
          strokeWidth={2 / scale}
          draggable
          onMouseDown={(event) => {
            event.cancelBubble = true;
          }}
          onTouchStart={(event) => {
            event.cancelBubble = true;
          }}
          onDragMove={(event) => handleDragMove(index, event.target)}
          onDragEnd={(event) => handleDragEnd(index, event.target)}
        />
      ))}
    </>
  );
}
