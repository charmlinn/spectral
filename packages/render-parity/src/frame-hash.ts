import { createHash } from "node:crypto";

import type { RenderFrameFingerprint } from "./contracts";

function toUint8Array(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

export function hashFrameBuffer(
  frame: number,
  buffer: Uint8Array | ArrayBuffer,
): RenderFrameFingerprint {
  const bytes = toUint8Array(buffer);

  return {
    frame,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.byteLength,
  };
}
