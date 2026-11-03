import { GLYPHS } from './glyphs';

interface GlyphProps {
  char: string;
  className?: string;
}

/** 以內嵌向量繪製單一漢字，所有裝置都會呈現相同字形。 */
export function Glyph({ char, className }: GlyphProps) {
  return (
    <svg viewBox="0 0 1000 1000" className={className} aria-hidden="true" focusable="false">
      <path d={GLYPHS[char] ?? ''} fill="currentColor" />
    </svg>
  );
}
