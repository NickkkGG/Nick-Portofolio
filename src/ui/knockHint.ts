import { canKnock } from '@/experience/chapters/room/knock';

/** Seconds of stillness in the room before the OSD suggests knocking (spec §3.3). */
export const KNOCK_HINT_IDLE = 5;

export function showKnockHint(now: number, lastActivity: number, p: number): boolean {
  return canKnock(p) && now - lastActivity >= KNOCK_HINT_IDLE;
}
