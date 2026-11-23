import { rangoMedio } from "./leer-medio-vuelo.service";
describe("Range de medios", () => {
    it.each([
        [undefined, 0, 99, false],
        ["bytes=0-9", 0, 9, true],
        ["bytes=90-", 90, 99, true],
        ["bytes=-10", 90, 99, true],
        ["bytes=0-1000", 0, 99, true],
    ])("interpreta %s", (range, inicio, fin, parcial) => {
        expect(rangoMedio(range, 100)).toEqual({ inicio, fin, parcial });
    });
    it.each([
        "bytes=100-",
        "bytes=8-2",
        "bytes=-0",
        "bytes=0-1,3-4",
        "otro",
        "bytes=-",
        "bytes=999999999999999999999-",
    ])("rechaza %s", (r) => {
        expect(() => rangoMedio(r, 100)).toThrow();
    });
});
