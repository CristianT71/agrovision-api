import { parsearSrt, puntoSrt } from "./parser-srt";
async function* lineas(texto: string) {
    yield* texto.split("\n");
}
describe("SRT DJI provisional", () => {
    it("tolera tags combinados, signos y espacios", async () => {
        const puntos = await parsearSrt(
            lineas(
                "1\n00:00:01,020 --> 00:00:02,000\n[latitude: +1.85] [longitude: -76.05] [rel_alt: 80 abs_alt: 1350]\nruido\n[LATITUDE:1.86] [LONGITUDE:-76.06]",
            ),
        );
        expect(puntos).toEqual([
            { tiempo: "00:00:01.020", lat: 1.85, lon: -76.05, rel_alt: 80, abs_alt: 1350 },
            { tiempo: "00:00:01.020", lat: 1.86, lon: -76.06, rel_alt: null, abs_alt: null },
        ]);
    });
    it("ignora líneas inválidas y limita a 500 puntos", async () => {
        expect(puntoSrt("[latitude:99] [longitude:3]", null)).toBeNull();
        expect(puntoSrt("[latitude:1]", null)).toBeNull();
        expect(await parsearSrt(lineas(Array(700).fill("[latitude:1] [longitude:2]").join("\n")))).toHaveLength(500);
    });
});
