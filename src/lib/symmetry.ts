import * as THREE from "three";

/**
 * Reflect an array of 3D points across the vertical axis (X = 0 plane).
 * Returns a new array — does not mutate the input.
 */
export function mirrorVertical(points: THREE.Vector3[]): THREE.Vector3[] {
  return points.map((p) => new THREE.Vector3(-p.x, p.y, p.z));
}

/**
 * Generate rotational copies of a point array around the Z axis.
 *
 * @param points  The original set of points
 * @param folds   Number of rotational copies (e.g. 6 for a hexagonal mandala)
 * @returns       Array of `folds - 1` rotated copies (the original is NOT included)
 */
export function mandalaRotation(
  points: THREE.Vector3[],
  folds: number
): THREE.Vector3[][] {
  const copies: THREE.Vector3[][] = [];

  for (let i = 1; i < folds; i++) {
    const angle = (i * Math.PI * 2) / folds;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    copies.push(
      points.map(
        (p) =>
          new THREE.Vector3(
            p.x * cos - p.y * sin,
            p.x * sin + p.y * cos,
            p.z
          )
      )
    );
  }

  return copies;
}

/**
 * Convenience: given anchor, end, and control points, produce all
 * symmetry copies as strand-shaped tuples.
 */
export type SymmetryMode = "mirror" | "mandala" | "free";

export interface StrandPoints {
  anchor: THREE.Vector3;
  end: THREE.Vector3;
  controlPoints: THREE.Vector3[];
}

export function applySymmetry(
  strand: StrandPoints,
  mode: SymmetryMode
): StrandPoints[] {
  const { anchor, end, controlPoints } = strand;
  const original: StrandPoints = { anchor, end, controlPoints };
  const results = [original];

  if (mode === "free") return results;

  if (mode === "mirror") {
    results.push({
      anchor: new THREE.Vector3(-anchor.x, anchor.y, anchor.z),
      end: new THREE.Vector3(-end.x, end.y, end.z),
      controlPoints: mirrorVertical(controlPoints),
    });
    return results;
  }

  if (mode === "mandala") {
    const FOLDS = 6;
    // Collect all points as a flat array, rotate, then split back
    const allPts = [anchor, ...controlPoints, end];
    const rotatedSets = mandalaRotation(allPts, FOLDS);

    for (const rotated of rotatedSets) {
      results.push({
        anchor: rotated[0],
        end: rotated[rotated.length - 1],
        controlPoints: rotated.slice(1, -1),
      });
    }
    return results;
  }

  return results;
}
