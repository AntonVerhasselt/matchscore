const DEFAULT_AVERAGE_CHAR_WIDTH = 0.54;
const GEORGIA_AVERAGE_CHAR_WIDTH = 0.58;
const ELLIPSIS = "...";

function averageCharacterWidthForFamily(fontFamily: string): number {
  return fontFamily === "Georgia"
    ? GEORGIA_AVERAGE_CHAR_WIDTH
    : DEFAULT_AVERAGE_CHAR_WIDTH;
}

export function measureTextForFit(
  text: string,
  fontSize: number,
  fontFamily: string,
): { width: number; height: number } {
  const averageCharacterWidth = averageCharacterWidthForFamily(fontFamily);
  const lines = text.split("\n");
  return {
    width:
      Math.max(...lines.map((line) => line.length), 1) *
      fontSize *
      averageCharacterWidth,
    height: lines.length * fontSize,
  };
}

export function ellipsizeText(text: string, width: number, fontSize: number): string {
  const averageCharacterWidth = DEFAULT_AVERAGE_CHAR_WIDTH;
  const ellipsisWidth = ELLIPSIS.length * fontSize * averageCharacterWidth;
  const availableWidth = Math.max(width - ellipsisWidth, fontSize * averageCharacterWidth);
  const maxCharacters = Math.max(
    Math.floor(availableWidth / (fontSize * averageCharacterWidth)),
    1,
  );

  if (text.length <= maxCharacters) {
    return text;
  }

  return `${text.slice(0, maxCharacters)}${ELLIPSIS}`;
}
