import { extname } from "node:path";
import type { Banda, Bloque, DatosExtraidos, Json, TipoArchivo } from "../entities/vuelo";

export function numero(valor: unknown): number | null {
    if (typeof valor !== "number" && typeof valor !== "string") return null;
    if (typeof valor === "string" && !valor.trim()) return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
}

// Se excluyen binarios y estructuras enormes; ningún valor textual supera 500 caracteres.
export function tagsLegibles(tags: Record<string, unknown>): Record<string, Json> {
    const limpiar = (v: unknown, profundidad: number): Json | undefined => {
        if (v === null || typeof v === "boolean") return v;
        if (typeof v === "string") return v.slice(0, 500);
        if (typeof v === "number") return Number.isFinite(v) ? v : null;
        if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
        if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer || profundidad > 5) return undefined;
        if (Array.isArray(v)) return v.slice(0, 32).map((x) => limpiar(x, profundidad + 1) ?? null);
        if (v && typeof v === "object") {
            return Object.fromEntries(
                Object.entries(v)
                    .slice(0, 200)
                    .flatMap(([k, x]) => {
                        if (
                            /thumbnail|makernote|previewimage|imagedata|stripoffset|stripbytecount|tileoffset|tilebytecount/i.test(
                                k,
                            )
                        )
                            return [];
                        const limpio = limpiar(x, profundidad + 1);
                        return limpio === undefined ? [] : [[k.slice(0, 100), limpio]];
                    }),
            );
        }
        return undefined;
    };
    return limpiar(tags, 0) as Record<string, Json>;
}

function aplanar(tags: Record<string, unknown>): Record<string, unknown> {
    const salida: Record<string, unknown> = {};
    const recorrer = (obj: Record<string, unknown>, nivel = 0) => {
        if (nivel > 5) return;
        for (const [k, v] of Object.entries(obj)) {
            salida[k] = v;
            salida[k.split(":").at(-1)!] = v;
            if (v && typeof v === "object" && !Array.isArray(v) && !ArrayBuffer.isView(v) && !(v instanceof Date))
                recorrer(v as Record<string, unknown>, nivel + 1);
        }
    };
    recorrer(tags);
    return salida;
}

export function clasificar(
    nombre: string,
    tags: Record<string, unknown>,
): { tipo: TipoArchivo; banda: Banda | null; bandaPorNombre: boolean } {
    const ext = extname(nombre).toLowerCase();
    if ([".mp4", ".mov"].includes(ext)) return { tipo: "video", banda: null, bandaPorNombre: false };
    if (ext === ".srt") return { tipo: "srt", banda: null, bandaPorNombre: false };
    const bandas: Record<string, Banda> = {
        green: "green",
        red: "red",
        rededge: "rededge",
        nir: "nir",
        "1": "green",
        "2": "red",
        "3": "rededge",
        "4": "nir",
    };
    const t = aplanar(tags);
    const porTag =
        bandas[
            String(t.BandName ?? "")
                .toLowerCase()
                .replace(/[ _-]/g, "")
        ] ?? bandas[String(t.SensorIndex)];
    const sufijo = /_MS_(NIR|RE|G|R)(?:\.[^.]+)$/i.exec(nombre)?.[1]?.toUpperCase();
    const porNombre = sufijo
        ? ({ G: "green", R: "red", RE: "rededge", NIR: "nir" } as const)[sufijo as "G" | "R" | "RE" | "NIR"]
        : null;
    const banda = porTag ?? porNombre ?? null;
    if ([".jpg", ".jpeg", ".tif", ".tiff"].includes(ext) && (banda || t.BandName != null || t.SensorIndex != null))
        return { tipo: "banda_multiespectral", banda, bandaPorNombre: !porTag && !!porNombre };
    return { tipo: [".jpg", ".jpeg", ".dng"].includes(ext) ? "foto_rgb" : "otro", banda: null, bandaPorNombre: false };
}

function fechaCaptura(valor: unknown, offset: unknown): Date | null {
    if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
    if (typeof valor !== "string") return null;
    const iso = valor
        .trim()
        .replace(/^(\d{4}):(\d{2}):(\d{2})[ T]/, "$1-$2-$3T")
        .replace(" ", "T");
    const zona = typeof offset === "string" && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : "-05:00";
    const fecha = new Date(/[zZ]$|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + zona);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function normalizarTags(tags: Record<string, unknown>, nombre: string): DatosExtraidos {
    const t = aplanar(tags);
    const n = (...claves: string[]) => {
        for (const clave of claves) {
            const v = numero(t[clave]);
            if (v !== null) return v;
        }
        return null;
    };
    const texto = (clave: string) => (typeof t[clave] === "string" ? (t[clave] as string).slice(0, 500) : null);
    const bloque = (v: Record<string, Json>): Bloque =>
        Object.values(v).every(
            (x) => x === null || (typeof x === "object" && x && Object.values(x).every((y) => y === null)),
        )
            ? null
            : v;
    const coordenada = (claves: string[], ref: string, limite: number) => {
        let valor = n(claves[0], claves[1]);
        if (valor === null && Array.isArray(t[claves[1]])) {
            const dms = (t[claves[1]] as unknown[]).map(numero);
            if (dms.length === 3 && dms.every((x) => x !== null)) valor = dms[0]! + dms[1]! / 60 + dms[2]! / 3600;
        }
        if (valor !== null && /^[SW]$/i.test(String(t[ref]))) valor = -Math.abs(valor);
        if (valor === null) valor = n(claves[2]);
        return valor !== null && Math.abs(valor) <= limite ? valor : null;
    };
    const latitud = coordenada(["latitude", "GPSLatitude", "GpsLatitude"], "GPSLatitudeRef", 90);
    const longitud = coordenada(["longitude", "GPSLongitude", "GpsLongitude"], "GPSLongitudeRef", 180);
    const rtkFlag = n("RtkFlag");
    const estado =
        ({ normal: "normal", rtk: "rtk", invalid: "invalido" } as Record<string, string>)[
            String(t.GpsStatus).toLowerCase()
        ] ?? null;
    const clasificacion = clasificar(nombre, tags);
    const tipoAltitud = ["RtkAlt", "GPSFusionAlt", "PressureAlt"].includes(String(t.AltitudeType))
        ? (t.AltitudeType as DatosExtraidos["tipoAltitud"])
        : null;
    const crudos = tagsLegibles(tags);
    if (t.DateTimeOriginal != null) {
        crudos.fechaCapturaOriginal = String(t.DateTimeOriginal).slice(0, 500);
        crudos.zonaHorariaCaptura = texto("OffsetTimeOriginal") ?? "America/Bogota (UTC-5)";
    }
    if (clasificacion.bandaPorNombre) crudos.bandaInferidaPorNombreNoVerificada = true;
    const gps = bloque({
        estado,
        rtkFlag,
        rtkFijo: null,
        desviacion: { longitud: n("RtkStdLon"), latitud: n("RtkStdLat"), altura: n("RtkStdHgt") },
    });
    if (gps) gps.rtkFijo = rtkFlag === 50;
    return {
        tipo: clasificacion.tipo,
        banda: clasificacion.banda,
        capturadoEn: fechaCaptura(t.DateTimeOriginal, t.OffsetTimeOriginal),
        latitud,
        longitud,
        altitudAbsolutaM: n("AbsoluteAltitude"),
        alturaRelativaM: n("RelativeAltitude"),
        tipoAltitud,
        rtkFlag,
        metadatos: {
            crudos,
            gps,
            camara: bloque({
                marca: texto("Make"),
                modelo: texto("Model"),
                exposicionS: n("ExposureTime"),
                iso: n("ISO", "ISOSpeedRatings"),
                distanciaFocalMm: n("FocalLength"),
                ancho: n("ExifImageWidth", "ImageWidth", "PixelXDimension"),
                alto: n("ExifImageHeight", "ImageHeight", "PixelYDimension"),
            }),
            orientacion: bloque({
                gimbalRollGrados: n("GimbalRollDegree"),
                gimbalPitchGrados: n("GimbalPitchDegree"),
                gimbalYawGrados: n("GimbalYawDegree"),
                vueloRollGrados: n("FlightRollDegree"),
                vueloPitchGrados: n("FlightPitchDegree"),
                vueloYawGrados: n("FlightYawDegree"),
            }),
            multiespectral: bloque({
                irradiancia: n("Irradiance"),
                ganancia: n("SensorGainAdjustment"),
                nivelNegro: n("BlackLevel"),
                frecuenciaBanda: texto("BandFreq"),
            }),
            dron: bloque({ serie: texto("DroneID") }),
        },
    };
}
