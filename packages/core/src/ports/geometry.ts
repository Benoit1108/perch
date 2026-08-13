/** Un point dans l'espace global du bureau, en pixels logiques. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Un rectangle dans l'espace global du bureau. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
