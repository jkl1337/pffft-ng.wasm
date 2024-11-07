import { describe, it, expect, vi } from "vitest";
import { loadLibrary, ValueType } from "./index.js";
import { readFile } from "fs/promises";

vi.stubGlobal(
    "fetch",
    vi.fn(async (input) => {
        const wasm = await readFile((input as URL).pathname);
        return new Response(wasm, { status: 200, headers: { "Content-Type": "application/wasm" } });
    }),
);

describe("library", () => {
    it("should prevent illegal buffer passing", async () => {
        const lib1 = await loadLibrary(Float32Array, ValueType.COMPLEX);
        const lib2 = await loadLibrary(Float64Array, ValueType.COMPLEX);

        const setup1 = lib1.setup(64);
        const sig1 = setup1.makeSignalBuffer();

        const setup2 = lib2.setup(64);
        const spec2 = setup2.makeSpectrumBuffer();

        expect(() => setup2.forward(sig1 as unknown as ReturnType<typeof setup2.makeSignalBuffer>, spec2)).toThrow();
    });
});

describe("operation", () => {
    it("should perform accurate forward and inverse FFT", async () => {
        const lib = await loadLibrary(Float32Array, ValueType.COMPLEX);
        using fft = lib.setup(16);

        using signal = fft.makeSignalBuffer();
        using spectrum = fft.makeSpectrumBuffer();

        for (let i = 0; i < 16; i++) {
            signal.array[i * 2] = i + 1.0;
            signal.array[i * 2 + 1] = i - 2.0;
        }

        fft.forward(signal, spectrum);

        const expected = new Float32Array([
            136.0, 88.0, -48.218716, 32.218716, -27.31371, 11.313708, -19.972847, 3.972846, -16.0, 0.0, -13.345428,
            -2.6545706, -11.313709, -4.6862917, -9.591298, -6.408703, -8.0, -8.0, -6.408703, -9.591298, -4.6862917,
            -11.313708, -2.6545706, -13.345429, 0.0, -16.0, 3.972845, -19.972847, 11.313707, -27.31371, 32.218716,
            -48.218716,
        ]);

        for (let i = 0; i < 32; i++) {
            expect(spectrum.array[i]).toBeCloseTo(expected[i]);
        }

        const signalInverse = fft.makeSignalBuffer();
        fft.inverse(spectrum, signalInverse);
        for (let i = 0; i < 32; i++) {
            expect(signalInverse.array[i]).toBeCloseTo(signal.array[i] * 16);
        }
    });
});
