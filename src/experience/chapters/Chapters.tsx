import { Cassettes } from './contact/Cassettes';
import { Depths } from './depths/Depths';
import { Fall } from './fall/Fall';
import { LoopRoof } from './loop/LoopRoof';
import { Problem } from './problem/Problem';
import { Room } from './room/Room';
import { Spiral } from './spiral/Spiral';
import { Keycaps } from './stack/Keycaps';

export function Chapters() {
  return (
    <>
      <Room />
      <Fall />
      <Spiral />
      <Depths />
      <Problem />
      <Keycaps />
      <Cassettes />
      <LoopRoof />
    </>
  );
}
