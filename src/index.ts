enum Direction {
    FORWARD = 0,
    BACKWARD = 1,
}

export enum ValueType {
    REAL = 0,
    COMPLEX = 1,
}

type FloatArray = Float32Array | Float64Array;
type FloatArrayType<A extends FloatArray> = A extends Float32Array ? Float32ArrayConstructor : Float64ArrayConstructor;

interface FloatArrayClass<A extends FloatArray> {
    new (buffer: ArrayBuffer, byteOffset: number, length: number): A;
    BYTES_PER_ELEMENT: number;
}

type PFFFTSetup = number;
type PFFFTDSetup = number;

type F32Ptr = number;
type F64Ptr = number;

export interface Exports extends WebAssembly.Exports {
    memory: WebAssembly.Memory;
    _initialize(): void;
}

interface Pffft32Exports extends Exports {
    pffft_new_setup(n: number, transform: ValueType): PFFFTSetup;
    pffft_destroy_setup(setup: PFFFTSetup): void;
    pffft_transform(setup: PFFFTSetup, input: F32Ptr, output: F32Ptr, work: F32Ptr, direction: Direction): void;
    pffft_transform_ordered(setup: PFFFTSetup, input: F32Ptr, output: F32Ptr, work: F32Ptr, direction: Direction): void;
    pffft_zreorder(setup: PFFFTSetup, input: F32Ptr, output: F32Ptr, direction: Direction): void;
    pffft_zconvolve_accumulate(setup: PFFFTSetup, dftA: F32Ptr, dftB: F32Ptr, dftAB: F32Ptr, scaling: number): void;
    pffft_zconvolve_no_accu(setup: PFFFTSetup, dftA: F32Ptr, dftB: F32Ptr, dftAB: F32Ptr, scaling: number): void;
    pffft_simd_size(): number;
    pffft_min_fft_size(transform: ValueType): number;
    pffft_is_valid_size(n: number, transform: ValueType): boolean;
    pffft_nearest_transform_size(n: number, transform: ValueType, higher: boolean): number;

    pffft_aligned_malloc(size: number): F32Ptr;
    pffft_aligned_free(ptr: F32Ptr): void;
}

interface Pffft64Exports extends Exports {
    pffftd_new_setup(n: number, transform: ValueType): PFFFTDSetup;
    pffftd_destroy_setup(setup: PFFFTDSetup): void;
    pffftd_transform(setup: PFFFTDSetup, input: F64Ptr, output: F64Ptr, work: F64Ptr, direction: Direction): void;
    pffftd_transform_ordered(
        setup: PFFFTDSetup,
        input: F64Ptr,
        output: F64Ptr,
        work: F64Ptr,
        direction: Direction,
    ): void;
    pffftd_zreorder(setup: PFFFTDSetup, input: F64Ptr, output: F64Ptr, direction: Direction): void;
    pffftd_zconvolve_accumulate(setup: PFFFTDSetup, dftA: F64Ptr, dftB: F64Ptr, dftAB: F64Ptr, scaling: number): void;
    pffftd_zconvolve_no_accu(setup: PFFFTDSetup, dftA: F64Ptr, dftB: F64Ptr, dftAB: F64Ptr, scaling: number): void;
    pffftd_simd_size(): number;
    pffftd_min_fft_size(transform: ValueType): number;
    pffftd_is_valid_size(n: number, transform: ValueType): boolean;
    pffftd_nearest_transform_size(n: number, transform: ValueType, higher: boolean): number;

    pffftd_aligned_malloc(size: number): F64Ptr;
    pffftd_aligned_free(ptr: F64Ptr): void;
}

type PffftExportsType<A> = A extends Float32Array ? Pffft32Exports : Pffft64Exports;

class Buffer<A extends FloatArray, T extends ValueType> implements Disposable {
    readonly array: A;
    readonly _exports: A extends Float32Array ? Pffft32Exports : Pffft64Exports;

    constructor(
        arrayType: FloatArrayType<A>,
        n: number,
        readonly type: T,
        exports: PffftExportsType<A>,
    ) {
        const arrayClass = arrayType as unknown as FloatArrayClass<A>;

        n *= type === ValueType.REAL ? 1 : 2;

        const alloc =
            arrayType === Float32Array
                ? (exports as Pffft32Exports).pffft_aligned_malloc
                : (exports as Pffft64Exports).pffftd_aligned_malloc;
        const ptr = alloc(arrayClass.BYTES_PER_ELEMENT * n);
        if (ptr === 0) {
            throw new Error("Failed to allocate memory");
        }
        this.array = new arrayClass(exports.memory.buffer, ptr, n);
        this._exports = exports;
    }

    [Symbol.dispose](): void {
        const exports = this._exports;
        const free =
            this.ctor === Float32Array
                ? (exports as Pffft32Exports).pffft_aligned_free
                : (exports as Pffft64Exports).pffftd_aligned_free;
        free(this.array.byteOffset);
        (this as { array: A | null }).array = null;
    }

    get ptr(): number {
        return this.array.byteOffset;
    }

    get _memory(): ArrayBuffer {
        return this.array.buffer;
    }

    get ctor(): FloatArrayType<A> {
        return this.array.constructor as FloatArrayType<A>;
    }
}

class SetupImplFloat32 implements Disposable {
    #ptr: number;
    readonly #exports: Pffft32Exports;

    constructor(n: number, type: ValueType, exports: Pffft32Exports) {
        this.#ptr = exports.pffft_new_setup(n, type);
        if (this.#ptr === 0) {
            throw new Error("Failed to create PFFFT setup");
        }
        this.#exports = exports;
    }

    [Symbol.dispose](): void {
        this.#exports.pffft_destroy_setup(this.#ptr);
        this.#ptr = 0;
    }

    transform(input: number, output: number, work: number, direction: Direction): void {
        this.#exports.pffft_transform(this.#ptr, input, output, work, direction);
    }

    transformOrdered(input: number, output: number, work: number, direction: Direction): void {
        this.#exports.pffft_transform_ordered(this.#ptr, input, output, work, direction);
    }

    zreorder(input: number, output: number, direction: Direction): void {
        this.#exports.pffft_zreorder(this.#ptr, input, output, direction);
    }

    zconvolveAccu(dftA: number, dftB: number, dftAB: number, scaling: number): void {
        this.#exports.pffft_zconvolve_accumulate(this.#ptr, dftA, dftB, dftAB, scaling);
    }

    zconvolveNoAccu(dftA: number, dftB: number, dftAB: number, scaling: number): void {
        this.#exports.pffft_zconvolve_no_accu(this.#ptr, dftA, dftB, dftAB, scaling);
    }
}

class SetupImplFloat64 {
    #ptr: number;
    readonly #exports: Pffft64Exports;

    constructor(n: number, type: ValueType, exports: Pffft64Exports) {
        this.#ptr = exports.pffftd_new_setup(n, type);
        if (this.#ptr === 0) {
            throw new Error("Failed to create PFFFT setup");
        }
        this.#exports = exports;
    }

    [Symbol.dispose](): void {
        this.#exports.pffftd_destroy_setup(this.#ptr);
        this.#ptr = 0;
    }

    transform(input: number, output: number, work: number, direction: Direction): void {
        this.#exports.pffftd_transform(this.#ptr, input, output, work, direction);
    }

    transformOrdered(input: number, output: number, work: number, direction: Direction): void {
        this.#exports.pffftd_transform_ordered(this.#ptr, input, output, work, direction);
    }

    zreorder(input: number, output: number, direction: Direction): void {
        this.#exports.pffftd_zreorder(this.#ptr, input, output, direction);
    }

    zconvolveAccu(dftA: number, dftB: number, dftAB: number, scaling: number): void {
        this.#exports.pffftd_zconvolve_accumulate(this.#ptr, dftA, dftB, dftAB, scaling);
    }

    zconvolveNoAccu(dftA: number, dftB: number, dftAB: number, scaling: number): void {
        this.#exports.pffftd_zconvolve_no_accu(this.#ptr, dftA, dftB, dftAB, scaling);
    }
}

function mismatchedInstanceError(): Error {
    return new Error("Mismatched PFFFT instances");
}

function checkFftBuffers<A extends FloatArray>(
    memory: ArrayBuffer,
    work: Buffer<A, ValueType>,
    signal: Buffer<A, ValueType>,
    spectrum: Buffer<A, ValueType>,
): void {
    if (memory !== signal._memory || memory !== spectrum._memory) {
        throw mismatchedInstanceError();
    }
    const minLen = work.array.length;
    if (signal.array.length < minLen) {
        throw new Error("signal buffer too small");
    }
    if (spectrum.array.length < minLen) {
        throw new Error("spectrum buffer too small");
    }
}

function checkConvolveBuffers<A extends FloatArray>(
    memory: ArrayBuffer,
    work: Buffer<A, ValueType>,
    a: Buffer<A, ValueType>,
    b: Buffer<A, ValueType>,
    ab: Buffer<A, ValueType>,
): void {
    if (memory !== a._memory || memory !== b._memory || memory !== ab._memory) {
        throw mismatchedInstanceError();
    }
    const minLen = work.array.length;
    if (a.array.length < minLen) {
        throw new Error("a buffer too small");
    }
    if (b.array.length < minLen) {
        throw new Error("b buffer too small");
    }
    if (ab.array.length < minLen) {
        throw new Error("ab buffer too small");
    }
}

export class Setup<A extends FloatArray, T extends ValueType> implements Disposable {
    readonly work: Buffer<A, T>;
    readonly #impl: SetupImplFloat32 | SetupImplFloat64;
    readonly #memory: ArrayBuffer;

    constructor(
        readonly arrayType: FloatArrayType<A>,
        type: T,
        readonly n: number,
        exports: PffftExportsType<A>,
    ) {
        if (arrayType === Float32Array) {
            this.#impl = new SetupImplFloat32(n, type, exports as Pffft32Exports);
        } else {
            this.#impl = new SetupImplFloat64(n, type, exports as Pffft64Exports);
        }
        this.#memory = exports.memory.buffer;
        this.work = new Buffer(arrayType, n, type, exports);
    }

    [Symbol.dispose](): void {
        this.#impl[Symbol.dispose]();
        this.work[Symbol.dispose]();
    }

    get type(): ValueType {
        return this.work.type;
    }

    makeSignalBuffer(extra = 0): Buffer<A, T> {
        return new Buffer(this.work.ctor, this.n + extra, this.work.type, this.work._exports);
    }

    makeSpectrumBuffer(extra = 0): Buffer<A, ValueType.COMPLEX> {
        const n = (this.work.type === ValueType.COMPLEX ? this.n : this.n / 2) + extra;
        return new Buffer(this.work.ctor, n, ValueType.COMPLEX, this.work._exports);
    }

    makeInternalLayoutBuffer(extra = 0): Buffer<A, ValueType.REAL> {
        const n = (this.work.type === ValueType.COMPLEX ? 2 : 1) * (this.n + extra);
        return new Buffer(this.work.ctor, n, ValueType.REAL, this.work._exports);
    }

    forward(signal: Buffer<A, T>, spectrum: Buffer<A, ValueType.COMPLEX>): void {
        const work = this.work;
        checkFftBuffers(this.#memory, work, signal, spectrum);
        this.#impl.transformOrdered(signal.ptr, spectrum.ptr, work.ptr, Direction.FORWARD);
    }

    inverse(spectrum: Buffer<A, ValueType.COMPLEX>, signal: Buffer<A, T>): void {
        const work = this.work;
        checkFftBuffers(this.#memory, work, signal, spectrum);
        this.#impl.transformOrdered(spectrum.ptr, signal.ptr, work.ptr, Direction.BACKWARD);
    }

    forwardToInternalLayout(signal: Buffer<A, T>, spectrum: Buffer<A, ValueType.REAL>): void {
        const work = this.work;
        checkFftBuffers(this.#memory, work, signal, spectrum);
        this.#impl.transform(signal.ptr, spectrum.ptr, work.ptr, Direction.FORWARD);
    }

    inverseFromInternalLayout(spectrum: Buffer<A, ValueType.REAL>, signal: Buffer<A, T>): void {
        const work = this.work;
        checkFftBuffers(this.#memory, work, signal, spectrum);
        this.#impl.transform(spectrum.ptr, signal.ptr, work.ptr, Direction.BACKWARD);
    }

    reorder(spectrum: Buffer<A, ValueType.REAL>, output: Buffer<A, ValueType.COMPLEX>): void {
        const memory = this.#memory;
        if (memory !== spectrum._memory || memory !== output._memory) {
            throw mismatchedInstanceError();
        }
        const minN = (this.work.type === ValueType.COMPLEX ? 2 : 1) * this.n;
        if (spectrum.array.length < minN) {
            throw new Error("spectrum buffer too small");
        }
        if (output.array.length < minN) {
            throw new Error("output buffer too small");
        }
        this.#impl.zreorder(spectrum.ptr, output.ptr, Direction.FORWARD);
    }

    convolve(
        a: Buffer<A, ValueType.REAL>,
        b: Buffer<A, ValueType.REAL>,
        ab: Buffer<A, ValueType.REAL>,
        scaling: number,
    ): void {
        checkConvolveBuffers(this.#memory, this.work, a, b, ab);
        this.#impl.zconvolveNoAccu(a.ptr, b.ptr, ab.ptr, scaling);
    }

    convolveAccumulate(
        a: Buffer<A, ValueType.REAL>,
        b: Buffer<A, ValueType.REAL>,
        ab: Buffer<A, ValueType.REAL>,
        scaling: number,
    ): void {
        checkConvolveBuffers(this.#memory, this.work, a, b, ab);
        this.#impl.zconvolveAccu(a.ptr, b.ptr, ab.ptr, scaling);
    }
}

export class FFTLibrary<A extends FloatArray, T extends ValueType> {
    readonly #exports: PffftExportsType<A>;

    constructor(
        readonly arrayType: FloatArrayType<A>,
        readonly type: T,
        exports: PffftExportsType<A>,
    ) {
        this.#exports = exports;
    }

    setup(n: number): Setup<A, T> {
        return new Setup(this.arrayType, this.type, n, this.#exports);
    }

    nearestValidSize(n: number, higher: boolean): number {
        const ex = this.#exports;
        return (
            this.arrayType === Float32Array
                ? (ex as Pffft32Exports).pffft_nearest_transform_size
                : (ex as Pffft64Exports).pffftd_nearest_transform_size
        )(n, this.type, higher);
    }

    isValidSize(n: number): boolean {
        const ex = this.#exports;
        return (
            this.arrayType === Float32Array
                ? (ex as Pffft32Exports).pffft_is_valid_size
                : (ex as Pffft64Exports).pffftd_is_valid_size
        )(n, this.type);
    }

    minFftSize(): number {
        const ex = this.#exports;
        return (
            this.arrayType === Float32Array
                ? (ex as Pffft32Exports).pffft_min_fft_size
                : (ex as Pffft64Exports).pffftd_min_fft_size
        )(this.type);
    }
}

export async function fetchWasm<E extends Exports>(url: URL, importObject?: WebAssembly.Imports): Promise<E> {
    const { instance } = await WebAssembly.instantiateStreaming(fetch(url), importObject);
    const exports = instance.exports as E;
    exports._initialize();
    return exports;
}

interface WasmConfig {
    path: string;
    exports: Exports | null;
}

const wasmConfigs = {
    f32: { path: "./pffft-ng-f32.wasm", exports: null },
    f64: { path: "./pffft-ng-f64.wasm", exports: null },
};

async function loadForConfig<E extends Exports>(config: WasmConfig, importObject?: WebAssembly.Imports): Promise<E> {
    if (!config.exports) {
        const url = new URL(config.path, import.meta.url);
        config.exports = await fetchWasm(url, importObject);
    }
    return config.exports as E;
}

export async function loadLibrary<A extends FloatArray, T extends ValueType>(
    arrayType: FloatArrayType<A>,
    type: T,
): Promise<FFTLibrary<A, T>> {
    const config = arrayType === Float32Array ? wasmConfigs.f32 : wasmConfigs.f64;
    const exports = await loadForConfig<PffftExportsType<A>>(config);
    return new FFTLibrary(arrayType, type, exports);
}
