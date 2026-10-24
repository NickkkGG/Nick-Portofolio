import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { beamGeometry } from './beamMaterial';
import { projectorCamera } from './projector';

describe("the beam's frustum", () => {
  it('is closed, with every face turned outward, so the near side is drawn from outside the beam', () => {
    const projector = projectorCamera();
    const position = beamGeometry(projector).getAttribute('position');
    expect(position.count).toBe(36);
    // A point well inside the beam, halfway down its throw.
    const inside = new Vector3(0, 0, 0.5).unproject(projector);
    const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()];
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
      const outward = new Vector3().addVectors(a, b).add(c).divideScalar(3).sub(inside);
      expect(normal.dot(outward)).toBeGreaterThan(0);
    }
  });
});
