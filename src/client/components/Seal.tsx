import { Glyph } from './Glyph';

/** 朱紅印章。`stamp` 為 true 時會播放蓋章動畫。 */
export function Seal({ char, stamp = false }: { char: string; stamp?: boolean }) {
  return (
    <span className={stamp ? 'seal seal--stamp' : 'seal'} aria-hidden="true">
      <Glyph char={char} />
    </span>
  );
}
