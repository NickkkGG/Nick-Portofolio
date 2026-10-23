import { ContactBlockout } from './contact/ContactBlockout';
import { DepthsBlockout } from './depths/DepthsBlockout';
import { FallBlockout } from './fall/FallBlockout';
import { LoopBlockout } from './loop/LoopBlockout';
import { ProblemBlockout } from './problem/ProblemBlockout';
import { Room } from './room/Room';
import { SpiralBlockout } from './spiral/SpiralBlockout';
import { StackBlockout } from './stack/StackBlockout';

export function Chapters() {
  return (
    <>
      <Room />
      <FallBlockout />
      <SpiralBlockout />
      <DepthsBlockout />
      <ProblemBlockout />
      <StackBlockout />
      <ContactBlockout />
      <LoopBlockout />
    </>
  );
}
