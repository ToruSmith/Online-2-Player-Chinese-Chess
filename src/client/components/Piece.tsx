import { pieceGlyph, pieceSide, RED } from '../../engine';
import { Glyph } from './Glyph';

interface PieceProps {
  piece: number;
  /** 讓對坐時黑方的字朝向對面。 */
  upsideDown?: boolean;
}

export function PieceFace({ piece, upsideDown = false }: PieceProps) {
  const color = pieceSide(piece) === RED ? 'red' : 'black';
  return (
    <span className={`disc disc--${color}`}>
      <span className="disc__ring">
        <Glyph
          char={pieceGlyph(piece)}
          className={upsideDown ? 'disc__glyph disc__glyph--flip' : 'disc__glyph'}
        />
      </span>
    </span>
  );
}
