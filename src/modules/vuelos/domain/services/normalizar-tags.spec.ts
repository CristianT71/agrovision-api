import { clasificar, normalizarTags, tagsLegibles } from "./normalizar-tags";

describe("Normalización DJI con tags inventados", () => {
    it("convierte coordenadas con signo y prioriza GPS EXIF", () => {
        const a = normalizarTags(
            {
                GPSLatitude: 1.8,
                GPSLongitude: -76.1,
                "drone-dji:GpsLatitude": "+51.49",
                "drone-dji:GpsLongitude": "-0.12",
            },
            "a.jpg",
        );
        expect([a.latitud, a.longitud]).toEqual([1.8, -76.1]);
        const b = normalizarTags({ "drone-dji:GpsLatitude": "+51.49", "drone-dji:GpsLongitude": "-0.12" }, "a.jpg");
        expect([b.latitud, b.longitud]).toEqual([51.49, -0.12]);
    });
    it.each([
        ["Normal", "normal"],
        ["RTK", "rtk"],
        ["Invalid", "invalido"],
        ["otro", null],
    ])("normaliza estado %s", (GpsStatus, estado) => {
        expect(normalizarTags({ GpsStatus }, "a.jpg").metadatos.gps?.estado ?? null).toBe(estado);
    });
    it.each([
        [50, true],
        [34, false],
        [16, false],
    ])("RtkFlag %s", (RtkFlag, rtkFijo) => {
        expect(normalizarTags({ RtkFlag: String(RtkFlag) }, "a.jpg").metadatos.gps).toEqual(
            expect.objectContaining({ rtkFlag: RtkFlag, rtkFijo }),
        );
    });
    it.each(["RtkAlt", "GPSFusionAlt", "PressureAlt"])("conserva tipo de altitud %s", (AltitudeType) => {
        const a = normalizarTags(
            {
                AltitudeType,
                AbsoluteAltitude: "+1350.1",
                RelativeAltitude: "80",
                RtkStdLat: "0.01",
                GimbalPitchDegree: "-90",
            },
            "a.tif",
        );
        expect(a).toMatchObject({ tipoAltitud: AltitudeType, altitudAbsolutaM: 1350.1, alturaRelativaM: 80 });
        expect(a.metadatos.orientacion?.gimbalPitchGrados).toBe(-90);
    });
    it("aplica offset o UTC-5 y conserva texto crudo", () => {
        const tags = { DateTimeOriginal: "2026:11:12 14:01:00" };
        expect(normalizarTags(tags, "a.jpg").capturadoEn?.toISOString()).toBe("2026-11-12T19:01:00.000Z");
        const a = normalizarTags({ ...tags, OffsetTimeOriginal: "+02:00" }, "a.jpg");
        expect(a.capturadoEn?.toISOString()).toBe("2026-11-12T12:01:00.000Z");
        expect(a.metadatos.crudos.fechaCapturaOriginal).toBe(tags.DateTimeOriginal);
    });
    it("sanea binarios, MakerNotes, miniaturas y textos", () => {
        expect(
            tagsLegibles({
                MakerNotes: { oculto: 1 },
                Thumbnail: Buffer.from("x"),
                bytes: new Uint8Array(3),
                texto: "x".repeat(800),
                nested: { a: 1 },
            }),
        ).toEqual({ texto: "x".repeat(500), nested: { a: 1 } });
    });
    it.each([
        ["a.jpg", {}, "foto_rgb", null],
        ["a.dng", {}, "foto_rgb", null],
        ["a.tif", { BandName: "RedEdge" }, "banda_multiespectral", "rededge"],
        ["a.jpg", { SensorIndex: 4 }, "banda_multiespectral", "nir"],
        ["a.tiff", { SensorIndex: 1 }, "banda_multiespectral", "green"],
        ["a.jpg", { BandName: "Red" }, "banda_multiespectral", "red"],
        ["a_MS_RE.TIF", {}, "banda_multiespectral", "rededge"],
        ["a.mp4", {}, "video", null],
        ["a.mov", {}, "video", null],
        ["a.srt", {}, "srt", null],
        ["a.tif", {}, "otro", null],
    ])("clasifica %s %j", (nombre, tags, tipo, banda) => {
        expect(clasificar(nombre as string, tags as Record<string, unknown>)).toMatchObject({ tipo, banda });
    });
    it("marca el sufijo no verificado y prefiere BandName sobre SensorIndex y nombre", () => {
        expect(normalizarTags({}, "a_MS_G.tif").metadatos.crudos.bandaInferidaPorNombreNoVerificada).toBe(true);
        expect(clasificar("a_MS_NIR.tif", { BandName: "Green", SensorIndex: 2 }).banda).toBe("green");
    });
    it("rechaza coordenadas fuera de rango y normaliza tags anidados", () => {
        expect(
            normalizarTags(
                { "drone-dji": { GpsLatitude: "+91", GpsLongitude: "-181", DroneID: "serie", ImageSource: "MS" } },
                "a.tif",
            ),
        ).toMatchObject({
            latitud: null,
            longitud: null,
            metadatos: { dron: { serie: "serie" }, crudos: { "drone-dji": { ImageSource: "MS" } } },
        });
    });
});
