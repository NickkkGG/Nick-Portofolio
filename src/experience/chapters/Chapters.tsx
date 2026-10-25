import { Booth } from './booth/Booth';
import { Cassettes } from './contact/Cassettes';
import { Depths } from './depths/Depths';
import { Fall } from './fall/Fall';
import { LoopRoof } from './loop/LoopRoof';
import { Room } from './room/Room';
import { Spiral } from './spiral/Spiral';
import { Tiles } from './stack/Tiles';

export function Chapters() {
  return (
    <>
      <Room />
      <Fall />
      <Booth />
      <Spiral />
      <Depths />
      <Tiles />
      <Cassettes />
      <LoopRoof />
    </>
  );
}
