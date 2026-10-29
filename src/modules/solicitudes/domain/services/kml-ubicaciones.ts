// Generador de KML (Google Earth). Funciones puras: sin Nest ni base de datos.

export interface PuntoKml {
    nombre: string;
    descripcion: string;
    latitud: number;
    longitud: number;
    altitudMsnm: number | null;
}

// Caracteres que XML 1.0 no admite ni escapados (controles salvo tab, salto de línea y retorno)
// eslint-disable-next-line no-control-regex
const CARACTERES_INVALIDOS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

// El nombre del productor o de la finca lo escribe una persona: un "&" o un "<" no pueden romper el archivo
export function escaparXml(texto: string): string {
    return texto
        .replace(CARACTERES_INVALIDOS, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function placemark(punto: PuntoKml): string {
    // KML pide longitud,latitud,altitud (al revés que el resto del mundo). Sin altitud conocida el punto
    // se pega al terreno: con "absolute" y 0 m quedaría a nivel del mar.
    const conAltitud = punto.altitudMsnm !== null;
    const coordenadas = `${punto.longitud},${punto.latitud},${conAltitud ? punto.altitudMsnm : 0}`;

    return [
        "    <Placemark>",
        `      <name>${escaparXml(punto.nombre)}</name>`,
        `      <description>${escaparXml(punto.descripcion)}</description>`,
        "      <Point>",
        `        <altitudeMode>${conAltitud ? "absolute" : "clampToGround"}</altitudeMode>`,
        `        <coordinates>${coordenadas}</coordinates>`,
        "      </Point>",
        "    </Placemark>",
    ].join("\n");
}

export function construirKml(nombreDocumento: string, puntos: PuntoKml[]): string {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        "  <Document>",
        `    <name>${escaparXml(nombreDocumento)}</name>`,
        ...puntos.map(placemark),
        "  </Document>",
        "</kml>",
        "",
    ].join("\n");
}
