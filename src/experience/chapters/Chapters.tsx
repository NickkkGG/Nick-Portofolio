import { ContactBlockout } from './contact/ContactBlockout';
import { DepthsBlockout } from './depths/DepthsBlockout';
import { FallBlockout } from './fall/FallBlockout';
import { LoopBlockout } from './loop/LoopBlockout';
import { ProblemBlockout } from './problem/ProblemBlockout';
import { RoomBlockout } from './room/RoomBlockout';
import { SpiralBlockout } from './spiral/SpiralBlockout';
import { StackBlockout } from './stack/StackBlockout';

export function Chapters() {
  return (
    <>
      <RoomBlockout />
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
