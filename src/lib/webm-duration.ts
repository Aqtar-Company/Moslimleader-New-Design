/**
 * Writes the real duration into a WebM produced by `MediaRecorder`.
 *
 * ## Why this has to exist
 *
 * `MediaRecorder` streams a file it cannot rewind, so it never writes a Duration into the
 * Segment's Info block. Players then report `Infinity`: the scrubber pins to the far end
 * and the elapsed time means nothing against it.
 *
 * The obvious workaround — have the player seek past the end so the browser walks to the
 * last cluster and works the length out — fixes the scrubber and BREAKS THE PICTURE. These
 * files carry no Cues index either, so after that seek the demuxer cannot find a keyframe
 * again: the clock advances over a frozen image. That was shipped, and it is why the
 * duration is repaired here instead, in the bytes, before the file is ever uploaded.
 *
 * ## What it does
 *
 * EBML is a tree of `[id][size][payload]`. This walks only the path it needs —
 * Segment → Info → Duration — and rewrites the file with a Duration element present. Two
 * cases: the element already exists and its 8 bytes are overwritten in place, or it is
 * absent and gets inserted, which means the sizes of Info (and of Segment, when it has a
 * known size) have to grow with it.
 *
 * Everything here fails by returning the original blob. A file that plays with a bad
 * scrubber is worth far more than a corrupted one, so no failure path may produce output.
 */

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_DURATION = 0x4489;
const ID_TIMECODE_SCALE = 0x2ad7b1;
/** MediaRecorder writes this when a size is not known ahead of time. */
const UNKNOWN_SIZE = -1;

type Reader = { buf: Uint8Array; pos: number };

/** EBML element ids keep their length marker; the id is the bytes as written. */
function readId(r: Reader): number | null {
  if (r.pos >= r.buf.length) return null;
  const first = r.buf[r.pos];
  let len = 0;
  for (let i = 0; i < 4; i++) if (first & (0x80 >> i)) { len = i + 1; break; }
  if (!len || r.pos + len > r.buf.length) return null;
  let id = 0;
  for (let i = 0; i < len; i++) id = id * 256 + r.buf[r.pos + i];
  r.pos += len;
  return id;
}

/** Sizes drop their length marker, and all-ones means "unknown". */
function readSize(r: Reader): { size: number; bytes: number } | null {
  if (r.pos >= r.buf.length) return null;
  const first = r.buf[r.pos];
  let len = 0;
  for (let i = 0; i < 8; i++) if (first & (0x80 >> i)) { len = i + 1; break; }
  if (!len || r.pos + len > r.buf.length) return null;

  let value = first & (0xff >> len);
  let allOnes = value === (0xff >> len);
  for (let i = 1; i < len; i++) {
    const b = r.buf[r.pos + i];
    if (b !== 0xff) allOnes = false;
    value = value * 256 + b;
  }
  r.pos += len;
  return { size: allOnes ? UNKNOWN_SIZE : value, bytes: len };
}

/**
 * EBML size encoding.
 *
 * `width` pins the field to an exact number of bytes. EBML allows a size to be written
 * wider than it needs to be — a muxer that does not yet know how big an element will be
 * reserves a fat field and fills it in later, which is exactly what MediaRecorder does — so
 * the minimal encoding of the new size is very often NARROWER than the field already in the
 * file. Re-encoding minimally and then insisting the widths match meant every such file was
 * refused and kept its broken scrubber. Padding to the original width is legal EBML and
 * keeps every byte offset in the file where it was.
 */
function encodeSize(value: number, width?: number): Uint8Array | null {
  for (let len = width ?? 1; len <= 8; len++) {
    // The all-ones value at each width is reserved (it means "unknown size"), so a value
    // needs a field strictly wider than that.
    const max = Math.pow(2, 7 * len) - 1;
    if (value < max) {
      const out = new Uint8Array(len);
      let v = value;
      for (let i = len - 1; i >= 0; i--) { out[i] = v & 0xff; v = Math.floor(v / 256); }
      out[0] |= 0x80 >> (len - 1);
      return out;
    }
    // A fixed width that cannot hold the value is a failure, not a reason to widen: any
    // widening shifts the rest of the file.
    if (width !== undefined) return null;
  }
  // Unreachable at any realistic size. Returning an encoding of ZERO here would have been
  // a silent-corruption fallback in a file whose whole policy is "fail by returning the
  // original", so it signals failure instead.
  return null;
}

type Found = {
  infoStart: number;       // first byte of the Info id
  infoPayloadStart: number;
  infoSize: number;
  infoSizeFieldAt: number;
  infoSizeFieldLen: number;
  segmentSizeFieldAt: number;
  segmentSizeFieldLen: number;
  segmentSize: number;
  durationPayloadAt: number | null;  // payload of an existing Duration, if any
  timecodeScale: number;             // nanoseconds per tick; 1e6 = milliseconds
};

function locate(buf: Uint8Array): Found | null {
  const r: Reader = { buf, pos: 0 };

  // Top level: skip elements until Segment.
  let segmentPayloadStart = -1;
  let segmentSizeFieldAt = -1;
  let segmentSizeFieldLen = 0;
  let segmentSize = UNKNOWN_SIZE;

  while (r.pos < buf.length) {
    const id = readId(r);
    if (id === null) return null;
    const sizeAt = r.pos;
    const s = readSize(r);
    if (!s) return null;
    if (id === ID_SEGMENT) {
      segmentPayloadStart = r.pos;
      segmentSizeFieldAt = sizeAt;
      segmentSizeFieldLen = s.bytes;
      segmentSize = s.size;
      break;
    }
    if (s.size === UNKNOWN_SIZE) return null;
    r.pos += s.size;
  }
  if (segmentPayloadStart < 0) return null;

  // Inside Segment: find Info.
  r.pos = segmentPayloadStart;
  const segmentEnd = segmentSize === UNKNOWN_SIZE ? buf.length : segmentPayloadStart + segmentSize;

  while (r.pos < segmentEnd && r.pos < buf.length) {
    const idAt = r.pos;
    const id = readId(r);
    if (id === null) return null;
    const sizeAt = r.pos;
    const s = readSize(r);
    if (!s) return null;
    const payloadStart = r.pos;

    if (id === ID_INFO) {
      if (s.size === UNKNOWN_SIZE) return null;
      const infoEnd = payloadStart + s.size;

      let durationPayloadAt: number | null = null;
      let timecodeScale = 1_000_000;

      const ir: Reader = { buf, pos: payloadStart };
      while (ir.pos < infoEnd) {
        const cid = readId(ir);
        if (cid === null) break;
        const cs = readSize(ir);
        if (!cs || cs.size === UNKNOWN_SIZE) break;
        if (cid === ID_DURATION) {
          // A Matroska Duration is a float and may legally be 4 bytes. Writing 8 over it
          // would clobber the id/size of the next Info child and return that blob — the
          // one outcome this file's contract forbids. Only an 8-byte element is claimed.
          if (cs.size === 8) durationPayloadAt = ir.pos;
        }
        if (cid === ID_TIMECODE_SCALE) {
          let v = 0;
          for (let i = 0; i < cs.size; i++) v = v * 256 + buf[ir.pos + i];
          if (v > 0) timecodeScale = v;
        }
        ir.pos += cs.size;
      }

      return {
        infoStart: idAt,
        infoPayloadStart: payloadStart,
        infoSize: s.size,
        infoSizeFieldAt: sizeAt,
        infoSizeFieldLen: s.bytes,
        segmentSizeFieldAt,
        segmentSizeFieldLen,
        segmentSize,
        durationPayloadAt,
        timecodeScale,
      };
    }

    // Clusters can be unknown-size; if we hit one before Info, Info is not coming.
    if (s.size === UNKNOWN_SIZE) return null;
    r.pos = payloadStart + s.size;
  }
  return null;
}

/**
 * Returns a blob whose header states `durationSeconds`, or the original blob unchanged if
 * anything about the file is not what this expects.
 */
export async function writeWebmDuration(blob: Blob, durationSeconds: number): Promise<Blob> {
  if (!isFinite(durationSeconds) || durationSeconds <= 0) return blob;

  try {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const found = locate(buf);
    if (!found) return blob;

    // Duration is a float, in TimecodeScale ticks — NOT in seconds.
    const ticks = (durationSeconds * 1e9) / found.timecodeScale;
    const durationValue = new Uint8Array(8);
    new DataView(durationValue.buffer).setFloat64(0, ticks, false);

    // Case 1: overwrite in place. Nothing moves, so no size needs touching.
    if (found.durationPayloadAt !== null) {
      const out = buf.slice();
      out.set(durationValue, found.durationPayloadAt);
      return new Blob([out], { type: blob.type || 'video/webm' });
    }

    // Case 2: insert. `[id 4489][size 88][8 bytes]` — 11 bytes into Info.
    const element = new Uint8Array(11);
    element[0] = 0x44;
    element[1] = 0x89;
    element[2] = 0x88; // size 8, one-byte encoding
    element.set(durationValue, 3);

    const newInfoSize = found.infoSize + element.length;
    // Written at the field's EXISTING width. Growing it would shift everything after Info
    // by a byte, and every offset recorded elsewhere in the file — Cues, SeekHead — would
    // then point one byte off.
    const newInfoSizeField = encodeSize(newInfoSize, found.infoSizeFieldLen);
    if (!newInfoSizeField) return blob;

    const out = new Uint8Array(buf.length + element.length);
    out.set(buf.subarray(0, found.infoSizeFieldAt), 0);
    out.set(newInfoSizeField, found.infoSizeFieldAt);

    const afterInfoSizeField = found.infoSizeFieldAt + found.infoSizeFieldLen;
    // Info's existing payload, then the new element at the END of it, then the rest.
    const infoPayloadEnd = found.infoPayloadStart + found.infoSize;
    out.set(buf.subarray(afterInfoSizeField, infoPayloadEnd), afterInfoSizeField);
    out.set(element, infoPayloadEnd);
    out.set(buf.subarray(infoPayloadEnd), infoPayloadEnd + element.length);

    // Segment's own size, when it has one, must grow too.
    if (found.segmentSize !== UNKNOWN_SIZE) {
      const newSegmentSize = found.segmentSize + element.length;
      const field = encodeSize(newSegmentSize, found.segmentSizeFieldLen);
      if (!field) return blob;
      out.set(field, found.segmentSizeFieldAt);
    }

    return new Blob([out], { type: blob.type || 'video/webm' });
  } catch {
    return blob;
  }
}
