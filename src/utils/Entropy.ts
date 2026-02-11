/**
 * A small, fast, deterministic, pseudo-random source of unpredictability.
 *
 * This implementation is based on the Alea pseudo-random number generation (PRNG)
 * style initialization + output step (using the Mash mixing function), producing
 * repeatable sequences for the same seed.
 *
 * Notes:
 * - This PRNG is **not** cryptographically secure. Do not use it for security-sensitive
 *   purposes (keys, tokens, gambling, etc.).
 * - All outputs are deterministic for a given seed and sequence of calls.
 */
export class Entropy {
    /**
     * The numeric seed currently associated with this generator instance.
     * Re-seeding will update this value.
     */
    public seed: number;

    /** Internal Mash function used for initialization/mixing. */
    private readonly mash: (data: string) => number;

    /** Internal Alea state. */
    private s0!: number;
    private s1!: number;
    private s2!: number;
    private c!: number;

    /**
     * Creates a new Entropy instance.
     *
     * @param seed - A numeric seed value. The same seed produces the same random sequence.
     *               Must be a finite number.
     * @throws Error if `seed` is not finite (NaN, +Infinity, -Infinity).
     */
    constructor(seed: number) {
        this.mash = Entropy.createMash();
        this.seed = seed;
        this.reseed(seed);
    }

    /**
     * Re-initializes the generator state using a new numeric seed.
     *
     * @param seed - A numeric seed value. Must be a finite number.
     * @returns This Entropy instance (for chaining).
     * @throws Error if `seed` is not finite (NaN, +Infinity, -Infinity).
     */
    reseed(seed: number): this {
        if (!Number.isFinite(seed)) {
            throw new Error("Entropy.reseed(seed): seed must be a finite number.");
        }

        this.seed = seed;

        // Convert the numeric seed to a stable string representation for Mash.
        // Using both a "label" and a stringified number reduces accidental collisions
        // from different types/contexts while keeping the API strictly numeric.
        const seedStr = `seed:${String(seed)}`;

        // Alea-style init
        this.s0 = this.mash(" ");
        this.s1 = this.mash(" ");
        this.s2 = this.mash(" ");
        this.c = 1;
        this.s0 -= this.mash(seedStr);
        if (this.s0 < 0) this.s0 += 1;
        this.s1 -= this.mash(seedStr);
        if (this.s1 < 0) this.s1 += 1;
        this.s2 -= this.mash(seedStr);
        if (this.s2 < 0) this.s2 += 1;
        return this;
    }

    /**
     * Returns a floating-point number in the range [0, 1).
     *
     * @returns A pseudo-random float `x` where `0 <= x < 1`.
     */
    random(): number {
        const t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10; // 2^-32
        this.s0 = this.s1;
        this.s1 = this.s2;
        this.s2 = t - (this.c = t | 0);
        return this.s2;
    }

    /**
     * Returns a boolean value with 50% probability for each outcome.
     * 
     * @returns A pseudo-random boolean value.
     */
    flip(): boolean {
        return this.random() < 0.5;
    }

    /**
     * Selects a random element from an array.
     *
     * @typeParam T - Element type.
     * @param a - Source array.
     * @returns A randomly selected element from `a`.
     * @throws Error if the array is empty.
     */
    randomElement<T>(a: T[]): T {
        if (a.length === 0)
            throw new Error(
                "Entpry.randomElement(a): cannot select from an empty array.",
            );
        return a[this.randomIndex(a)];
    }

    /**
     * Selects a random valid index from an array.
     *
     * @typeParam T - Element type (not used directly, but keeps API consistent).
     * @param a - Source array.
     * @returns A random index `i` where `0 <= i < a.length`.
     * @throws Error if the array is empty.
     */
    randomIndex<T>(a: T[]): number {
        if (a.length === 0)
            throw new Error("Entpry.randomIndex(a): array must not be empty.");
        const uint32 = (this.random() * 0x100000000) >>> 0; // 2^32
        return uint32 % a.length;
    }

    /**
     * Shuffles an array in place using the Fisher–Yates algorithm.
     *
     * @typeParam T - Element type.
     * @param a - The array to shuffle (modified in place).
     */
    shuffleInPlace<T>(a: T[]): void {
        for (let i = a.length - 1; i > 0; --i) {
            // Use (i + 1) so the chosen index includes i.
            const j = Math.floor(this.random() * (i + 1));
            const tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
        }
    }

    /**
     * Creates the Mash mixing function used to initialize the Alea state.
     *
     * @returns A function that maps a string to a float in [0, 1).
     */
    private static createMash(): (data: string) => number {
        let n = 0xefc8249d;

        return (data: string): number => {
            for (let i = 0; i < data.length; i++) {
                n += data.charCodeAt(i);
                let h = 0.02519603282416938 * n;
                n = h >>> 0;
                h -= n;
                h *= n;
                n = h >>> 0;
                h -= n;
                n += h * 0x100000000; // 2^32
            }
            return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
        };
    }
}
