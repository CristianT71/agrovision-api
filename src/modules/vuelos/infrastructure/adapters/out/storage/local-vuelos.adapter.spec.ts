import { mkdtemp, readdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { LocalVuelosAdapter } from "./local-vuelos.adapter";
const id = "11111111-1111-4111-8111-111111111111";
describe("Disco privado de vuelos", () => {
    let raiz: string, disco: LocalVuelosAdapter;
    const anterior = process.env.UPLOADS_DIR;
    beforeEach(async () => {
        raiz = await mkdtemp(join(tmpdir(), "vuelos-"));
        process.env.UPLOADS_DIR = raiz;
        disco = new LocalVuelosAdapter();
    });
    afterEach(async () => {
        if (anterior === undefined) delete process.env.UPLOADS_DIR;
        else process.env.UPLOADS_DIR = anterior;
        await rm(raiz, { recursive: true, force: true });
    });
    it("escribe por chunks y calcula SHA; ../../x.jpg no afecta la ruta", async () => {
        const contenido = Buffer.from([0xff, 0xd8, 1, 2, 3]);
        const a = await disco.recibir(
            id,
            "../../x.jpg",
            Readable.from([contenido.subarray(0, 1), contenido.subarray(1)]),
            100,
        );
        expect(a.rutaAlmacenamiento).toMatch(new RegExp(`^${id}/[a-f0-9-]{36}\\.jpg$`));
        expect(a.sha256).toBe(createHash("sha256").update(contenido).digest("hex"));
        expect(await readFile(disco.rutaLocal(a.rutaAlmacenamiento))).toEqual(contenido);
        await disco.eliminarArchivo(a.rutaAlmacenamiento);
        expect(await readdir(join(raiz, "vuelos", id))).toEqual([]);
    });
    it.each([
        ["a.exe", Buffer.from("x"), 100, 415],
        ["a.jpg", Buffer.from("texto"), 100, 422],
        ["a.mp4", Buffer.from([0xff, 0xd8]), 100, 422],
        ["a.jpg", Buffer.from([0xff, 0xd8, 0, 0]), 3, 413],
        ["a.srt", Buffer.from([0, 1, 2]), 100, 422],
    ])("rechaza %s y limpia el parcial", async (nombre, buffer, max, estado) => {
        await expect(disco.recibir(id, nombre, Readable.from([buffer]), max)).rejects.toMatchObject({ estado });
        expect(await readdir(join(raiz, "vuelos", id)).catch(() => [])).toEqual([]);
    });
    it("valida todo el SRT por streaming y acepta UTF-8 cortado entre chunks", async () => {
        const texto = Buffer.from("ñ texto");
        const a = await disco.recibir(id, "a.srt", Readable.from([texto.subarray(0, 1), texto.subarray(1)]), 100);
        expect(a.mime).toBe("application/x-subrip");
        await expect(
            disco.recibir(id, "b.srt", Readable.from([Buffer.from("texto"), Buffer.from([0xff])]), 100),
        ).rejects.toMatchObject({ estado: 422 });
    });
    it("genera miniaturas JPEG y TIFF 16 bits con lado largo 320", async () => {
        for (const ext of ["jpg", "tif"]) {
            // Archivos sintéticos temporales; ningún binario se añade al repositorio.
            const imagen = sharp({
                create: { width: 640, height: 400, channels: 3, background: { r: 40, g: 120, b: 200 } },
            });
            const buffer =
                ext === "tif" ? await imagen.toColourspace("rgb16").tiff().toBuffer() : await imagen.jpeg().toBuffer();
            const a = await disco.recibir(id, `a.${ext}`, Readable.from([buffer]), 1000000);
            expect(await disco.miniatura(a.rutaAlmacenamiento, a.mime)).toBe(true);
            const meta = await sharp(disco.rutaLocal(`${a.rutaAlmacenamiento}.miniatura.jpg`)).metadata();
            expect(Math.max(meta.width, meta.height)).toBe(320);
        }
    });
    it("una miniatura fallida o un video no rompe la subida", async () => {
        const a = await disco.recibir(id, "a.jpg", Readable.from([Buffer.from([0xff, 0xd8])]), 100);
        expect(await disco.miniatura(a.rutaAlmacenamiento, a.mime)).toBe(false);
        expect(await disco.miniatura(a.rutaAlmacenamiento, "video/mp4")).toBe(false);
        expect(() => disco.rutaLocal("../../x.jpg")).toThrow();
    });
});
