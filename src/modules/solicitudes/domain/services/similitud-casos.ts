import type { Solicitud } from "../entities/solicitud.entity";

// RF-04.3: similitud entre dos casos por su contexto. La API aún no recibe los embeddings
// que calcula el modelo en la app; cuando lleguen (módulo de detecciones) este cálculo puede
// reemplazarse por la distancia entre ellos sin cambiar a quien lo usa.
const PESOS = {
    organo: 35,
    cultivo: 20,
    ubicacion: 30,
    recencia: 15,
};

// Más allá de esta distancia dos fincas ya no se consideran vecinas
const KM_MAXIMOS = 50;
const DIAS_MAXIMOS = 365;

// Distancia entre dos puntos sobre la Tierra (fórmula de haversine), en kilómetros
export function distanciaKm(
    a: { latitud: number; longitud: number },
    b: { latitud: number; longitud: number },
): number {
    const radianes = (grados: number) => (grados * Math.PI) / 180;
    const dLat = radianes(b.latitud - a.latitud);
    const dLon = radianes(b.longitud - a.longitud);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(radianes(a.latitud)) * Math.cos(radianes(b.latitud)) * Math.sin(dLon / 2) ** 2;

    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function puntajeUbicacion(base: Solicitud, candidato: Solicitud): number {
    if (base.latitud !== null && base.longitud !== null && candidato.latitud !== null && candidato.longitud !== null) {
        const km = distanciaKm(
            { latitud: base.latitud, longitud: base.longitud },
            { latitud: candidato.latitud, longitud: candidato.longitud },
        );
        return Math.max(0, 1 - km / KM_MAXIMOS);
    }

    // Sin coordenadas: misma vereda vale más que solo el mismo municipio
    const mismoMunicipio = base.municipio.toLowerCase() === candidato.municipio.toLowerCase();
    if (!mismoMunicipio) return 0;

    return base.vereda.toLowerCase() === candidato.vereda.toLowerCase() ? 1 : 0.6;
}

function puntajeRecencia(base: Solicitud, candidato: Solicitud): number {
    const dias = Math.abs(base.fecha.getTime() - candidato.fecha.getTime()) / (24 * 60 * 60 * 1000);
    return Math.max(0, 1 - dias / DIAS_MAXIMOS);
}

// Devuelve un porcentaje de 0 a 100
export function calcularSimilitud(base: Solicitud, candidato: Solicitud): number {
    let puntos = 0;

    if (base.organo && base.organo === candidato.organo) puntos += PESOS.organo;
    if (base.cultivo && base.cultivo === candidato.cultivo) puntos += PESOS.cultivo;
    puntos += PESOS.ubicacion * puntajeUbicacion(base, candidato);
    puntos += PESOS.recencia * puntajeRecencia(base, candidato);

    return Math.round(puntos);
}
