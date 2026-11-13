import { ExifrMetadatosAdapter, lineasAcotadas } from "./exifr-metadatos.adapter";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
// La biblioteca no pudo descargarse en este entorno; se prueba el puerto con objetos de tags del contrato.
jest.mock("exifr", () => ({ parse: jest.fn() }), { virtual: true });
const exifr = require("exifr") as { parse: jest.Mock };
describe("Adaptador de metadata", () => {
    it("solicita EXIF, GPS y XMP sobre la cabecera (Buffer) y conserva drone-dji", async () => {
        exifr.parse.mockResolvedValue({
            "drone-dji:GpsLatitude": "+1.85",
            "drone-dji:GpsLongitude": "-76.05",
            "drone-dji:RtkFlag": 50,
        });
        const dir = await mkdtemp(join(tmpdir(), "vuelos-exif-"));
        try {
            const ruta = join(dir, "a.jpg");
            await writeFile(ruta, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
            var datos = await new ExifrMetadatosAdapter().extraer(ruta, "a.jpg");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
        expect(exifr.parse).toHaveBeenCalledWith(
            expect.any(Buffer),
            expect.objectContaining({ xmp: true, gps: true, reviveValues: false }),
        );
        expect(datos).toMatchObject({ latitud: 1.85, longitud: -76.05, rtkFlag: 50 });
    });
    it("un EXIF roto no rompe la subida", async () => {
        exifr.parse.mockRejectedValue(new Error("imagen rota"));
        const dir = await mkdtemp(join(tmpdir(), "vuelos-exif-"));
        try {
            const ruta = join(dir, "a.jpg");
            await writeFile(ruta, Buffer.from([0xff, 0xd8]));
            expect((await new ExifrMetadatosAdapter().extraer(ruta, "a.jpg")).metadatos.crudos.extraccionFallida).toBe(
                true,
            );
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
    it("lee SRT con líneas acotadas y no llama exifr para videos", async () => {
        const dir = await mkdtemp(join(tmpdir(), "vuelos-srt-"));
        try {
            const ruta = join(dir, "a.srt");
            await writeFile(
                ruta,
                "x".repeat(100000) + "\n00:00:01,000 --> 00:00:02,000\n[latitude:1.85] [longitude:-76.05]",
            );
            const lineas: string[] = [];
            for await (const linea of lineasAcotadas(ruta)) lineas.push(linea);
            expect(lineas[0]).toHaveLength(16384);
            expect((await new ExifrMetadatosAdapter().extraer(ruta, "a.srt")).metadatos.traza).toHaveLength(1);
            exifr.parse.mockClear();
            expect((await new ExifrMetadatosAdapter().extraer(ruta, "a.mov")).tipo).toBe("video");
            expect(exifr.parse).not.toHaveBeenCalled();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
