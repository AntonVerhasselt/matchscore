"use client";

import { useTranslations } from "next-intl";

import {
  SHAPE_CATEGORIES,
  type ShapePresetDragPayload,
  type ShapePresetId,
} from "@/lib/template-scene";

type ShapesPanelProps = {
  onShapeDragStart: (
    event: React.DragEvent<HTMLElement>,
    payload: ShapePresetDragPayload,
  ) => void;
  onShapeInsert: (presetId: ShapePresetId) => void;
};

export function ShapesPanel({
  onShapeDragStart,
  onShapeInsert,
}: ShapesPanelProps) {
  const t = useTranslations("app.automations.editor");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">{t("shapesPanelTitle")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t("shapesPanelDescription")}
        </p>
      </div>

      {SHAPE_CATEGORIES.map((category) => (
        <section key={category.id} className="space-y-2">
          <h3 className="text-sm font-semibold">
            {t(`shapeCategories.${category.labelKey}`)}
          </h3>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {category.presets.map((preset) => (
              <ShapePresetTile
                key={preset.id}
                presetId={preset.id}
                label={t(`shapePresets.${preset.labelKey}`)}
                onDragStart={(event) =>
                  onShapeDragStart(event, {
                    kind: "shape-preset",
                    presetId: preset.id,
                  })
                }
                onActivate={() => onShapeInsert(preset.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ShapePresetTile({
  presetId,
  label,
  onDragStart,
  onActivate,
}: {
  presetId: ShapePresetId;
  label: string;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      title={label}
      aria-label={label}
      className="flex w-[4.5rem] shrink-0 cursor-grab flex-col items-center gap-1.5 border bg-card px-2 py-2.5 text-center transition-colors hover:border-primary/50 active:cursor-grabbing"
      onDragStart={onDragStart}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
        }
      }}
    >
      <ShapePresetPreview presetId={presetId} />
      <span className="line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">
        {label}
      </span>
    </button>
  );
}

function ShapePresetPreview({ presetId }: { presetId: ShapePresetId }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className="size-10 text-foreground"
      aria-hidden
    >
      <ShapePresetPath presetId={presetId} />
    </svg>
  );
}

function ShapePresetPath({ presetId }: { presetId: ShapePresetId }) {
  const fill = "currentColor";
  const stroke = "currentColor";

  switch (presetId) {
    case "rect-square":
      return <rect x="6" y="6" width="28" height="28" fill={fill} />;
    case "rect-rounded":
      return (
        <rect
          x="5"
          y="9"
          width="30"
          height="22"
          rx="6"
          ry="6"
          fill={fill}
        />
      );
    case "rect-wide":
      return <rect x="3" y="13" width="34" height="14" fill={fill} />;
    case "circle":
      return <circle cx="20" cy="20" r="14" fill={fill} />;
    case "triangle":
      return <polygon points="20,5 35,33 5,33" fill={fill} />;
    case "triangle-inverted":
      return <polygon points="20,35 35,7 5,7" fill={fill} />;
    case "pentagon":
      return (
        <polygon
          points="20,4 36,15 30,34 10,34 4,15"
          fill={fill}
        />
      );
    case "hexagon":
      return (
        <polygon
          points="20,4 34,12 34,28 20,36 6,28 6,12"
          fill={fill}
        />
      );
    case "octagon":
      return (
        <polygon
          points="14,4 26,4 36,14 36,26 26,36 14,36 4,26 4,14"
          fill={fill}
        />
      );
    case "star-4":
      return (
        <polygon
          points="20,2 24,16 38,16 27,24 31,38 20,30 9,38 13,24 2,16 16,16"
          fill={fill}
        />
      );
    case "star-5":
      return (
        <polygon
          points="20,2 24,15 38,15 27,23 31,36 20,28 9,36 13,23 2,15 16,15"
          fill={fill}
        />
      );
    case "star-6":
      return (
        <polygon
          points="20,2 24,14 36,14 28,22 31,34 20,28 9,34 12,22 4,14 16,14"
          fill={fill}
        />
      );
    case "line-solid":
      return (
        <line
          x1="4"
          y1="20"
          x2="36"
          y2="20"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
        />
      );
    case "line-dashed":
      return (
        <line
          x1="4"
          y1="20"
          x2="36"
          y2="20"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="6 4"
        />
      );
    case "line-dotted":
      return (
        <line
          x1="4"
          y1="20"
          x2="36"
          y2="20"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="2 5"
        />
      );
    case "arrow-right":
      return (
        <>
          <line
            x1="4"
            y1="20"
            x2="30"
            y2="20"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <polygon points="30,12 38,20 30,28" fill={fill} />
        </>
      );
    case "arrow-both":
      return (
        <>
          <line
            x1="8"
            y1="20"
            x2="32"
            y2="20"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <polygon points="8,12 2,20 8,28" fill={fill} />
          <polygon points="32,12 38,20 32,28" fill={fill} />
        </>
      );
  }
}
