import { describe, it, expect } from "vitest";
import { createPicker } from "./picker";

// A fake WebGL2 that refuses everything that would make the CPU wait for the GPU,
// and lets the test decide when the GPU is done
function fakeGl() {
  const C = {
    FRAMEBUFFER: 0x8d40,
    TEXTURE_2D: 0x0de1,
    COLOR_ATTACHMENT0: 0x8ce0,
    RGBA: 0x1908,
    RGBA8: 0x8058,
    UNSIGNED_BYTE: 0x1401,
    PIXEL_PACK_BUFFER: 0x88eb,
    STREAM_READ: 0x88e1,
    SYNC_GPU_COMMANDS_COMPLETE: 0x9117,
    SYNC_STATUS: 0x9114,
    SIGNALED: 0x9119,
    UNSIGNALED: 0x9118,
  };
  const framebuffer = { name: "pick framebuffer" };
  const texture = { name: "pick texture" };
  const buffer = { name: "pixel buffer" };
  const log: string[] = [];
  const syncs = new Set<object>();
  let packBuffer: object | null = null; // what is bound to PIXEL_PACK_BUFFER
  let signaled = false;
  let gpuPixel = [0, 0, 0, 255];

  const gl = {
    ...C,
    createFramebuffer: () => framebuffer,
    createTexture: () => texture,
    createBuffer: () => buffer,
    bindTexture: () => {},
    texImage2D: () => {},
    framebufferTexture2D: () => {},
    bufferData: () => {},
    bindBuffer: (_target: number, b: object | null) => (packBuffer = b),
    bindFramebuffer: (_target: number, fb: object | null) =>
      log.push(fb === framebuffer ? "bind pick" : "bind canvas"),
    viewport: (_x: number, _y: number, w: number, h: number) =>
      log.push(`viewport ${w}×${h}`),
    readPixels: (...args: unknown[]) => {
      if (typeof args[6] !== "number")
        throw new Error("readPixels into an array: the CPU waits for the GPU");
      if (packBuffer !== buffer)
        throw new Error("readPixels without the pixel buffer bound");
      log.push("readPixels");
    },
    fenceSync: () => {
      const sync = {};
      syncs.add(sync);
      signaled = false;
      log.push("fence");
      return sync;
    },
    getSyncParameter: (_sync: object, p: number) =>
      p === C.SYNC_STATUS ? (signaled ? C.SIGNALED : C.UNSIGNALED) : null,
    clientWaitSync: () => {
      throw new Error("clientWaitSync: the CPU waits for the GPU");
    },
    finish: () => {
      throw new Error("finish: the CPU waits for the GPU");
    },
    deleteSync: (sync: object) => syncs.delete(sync),
    getBufferSubData: (_target: number, _offset: number, dst: Uint8Array) => {
      if (packBuffer !== buffer) throw new Error("getBufferSubData without the pixel buffer bound");
      dst.set(gpuPixel);
    },
    deleteBuffer: () => log.push("delete buffer"),
    deleteFramebuffer: () => log.push("delete framebuffer"),
    deleteTexture: () => log.push("delete texture"),
  };
  return {
    gl: gl as unknown as WebGL2RenderingContext,
    log,
    syncs,
    // The GPU has drawn the pixel: red + 256 × green is the id
    gpuDone: (red: number, green: number) => {
      signaled = true;
      gpuPixel = [red, green, 0, 255];
    },
  };
}

describe("createPicker", () => {
  it("draws the picking pass in its own 1×1 image, then asks for the pixel without waiting", () => {
    const fake = fakeGl();
    const picker = createPicker(fake.gl);
    fake.log.length = 0; // forget the setup
    picker.request(() => fake.log.push("draw"));
    expect(fake.log).toEqual([
      "bind pick",
      "viewport 1×1",
      "draw",
      "readPixels",
      "fence",
      "bind canvas",
    ]);
  });

  it("gives nothing while the GPU is not done", () => {
    const fake = fakeGl();
    const picker = createPicker(fake.gl);
    picker.request(() => {});
    expect(picker.poll()).toBeNull();
  });

  it("gives the id under the mouse once the GPU is done: red + 256 × green", () => {
    const fake = fakeGl();
    const picker = createPicker(fake.gl);
    picker.request(() => {});
    fake.gpuDone(4, 1);
    expect(picker.poll()).toBe(260);
  });

  it("gives each result once, and frees its fence", () => {
    const fake = fakeGl();
    const picker = createPicker(fake.gl);
    picker.request(() => {});
    fake.gpuDone(7, 0);
    picker.poll();
    expect(picker.poll()).toBeNull();
    expect(fake.syncs.size).toBe(0);
  });

  it("skips a request while the previous pixel is on its way", () => {
    const fake = fakeGl();
    const picker = createPicker(fake.gl);
    const drawn: number[] = [];
    picker.request(() => drawn.push(1));
    picker.request(() => drawn.push(2)); // still on its way: skipped
    fake.gpuDone(3, 0);
    picker.poll();
    picker.request(() => drawn.push(3)); // back: drawn again
    expect(drawn).toEqual([1, 3]);
  });

  it("says whether it sent the request: not while the previous pixel is on its way", () => {
    const fake = fakeGl();
    const picker = createPicker(fake.gl);
    expect(picker.request(() => {})).toBe(true);
    expect(picker.request(() => {})).toBe(false);
    fake.gpuDone(3, 0);
    picker.poll();
    expect(picker.request(() => {})).toBe(true);
  });

  it("has nothing to give before any request", () => {
    const fake = fakeGl();
    expect(createPicker(fake.gl).poll()).toBeNull();
  });

  it("frees everything on destroy, even a pixel on its way", () => {
    const fake = fakeGl();
    const picker = createPicker(fake.gl);
    picker.request(() => {});
    picker.destroy();
    expect(fake.syncs.size).toBe(0);
    expect(fake.log).toEqual(
      expect.arrayContaining(["delete buffer", "delete framebuffer", "delete texture"]),
    );
  });
});
