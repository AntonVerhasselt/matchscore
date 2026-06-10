export function measureTextForFit(
  text: string,
  fontSize: number,
  fontFamily: string,
): { width: number; height: number } {
  const averageCharacterWidth = fontFamily === "Georgia" ? 0.58 : 0.54;
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
  const maxCharacters = Math.max(Math.floor(width / (fontSize * 0.54)) - 1, 1);
  if (text.length <= maxCharacters) {
    return text;
  }

  return `${text.slice(0, maxCharacters)}...`;
}
