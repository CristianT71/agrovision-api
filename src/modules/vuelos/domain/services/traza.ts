import type { PuntoTraza } from "../entities/vuelo";

// El repositorio ya ordena y limita a 2001; el punto extra permite anunciar el recorte.
export function construirTraza(puntos: PuntoTraza[]) {
    const recortados = puntos.slice(0, 2000);
    const features: object[] = recortados.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.longitud, p.latitud] },
        properties: {
            archivoId: p.id,
            tipo: p.tipo,
            banda: p.banda,
            capturadoEn: p.capturadoEn?.toISOString() ?? null,
            altitudAbsolutaM: p.altitudAbsolutaM,
        },
    }));
    if (recortados.length >= 2)
        features.push({
            type: "Feature",
            geometry: { type: "LineString", coordinates: recortados.map((p) => [p.longitud, p.latitud]) },
            properties: {},
        });
    return { type: "FeatureCollection", features, truncado: puntos.length > 2000 };
}
