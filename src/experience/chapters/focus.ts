/** A box on the screen, in CSS pixels from the top left. */
export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The camcorder's focus brackets (ui/FocusBrackets.tsx), locking onto whatever is picked: a
 * tile in the stack, a tape in the contact. The scene places them every frame straight on
 * the element, so React never re-renders for it.
 */
class FocusBrackets {
  private element: HTMLElement | null = null;
  private locked: string | null = null;

  /** The brackets' element, while the chapter's texts are up. */
  attach(element: HTMLElement | null) {
    this.element = element;
    this.locked = null;
  }

  /** Frames the thing called `key` (`tile-3`, `tape-1`) at `rect`. */
  lock(key: string, rect: ScreenRect) {
    const element = this.element;
    if (!element) return;
    element.style.transform = `translate(${rect.x}px, ${rect.y}px)`;
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    if (this.locked !== key) {
      // Something new: the brackets come in from wide and blink as they lock, from the start.
      element.dataset.state = 'off';
      void element.offsetWidth;
      element.dataset.state = 'on';
      element.dataset.key = key;
      this.locked = key;
    }
  }

  /** Lets go, if the brackets are on one of `owner`'s things (`tile-`, `tape-`): the tiles and the tapes never undo each other. */
  release(owner: string) {
    if (!this.locked?.startsWith(owner)) return;
    if (this.element) this.element.dataset.state = 'off';
    this.locked = null;
  }
}

export const focusBrackets = new FocusBrackets();
