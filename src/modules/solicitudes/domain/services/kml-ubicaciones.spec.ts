import { construirKml, escaparXml } from "./kml-ubicaciones";

describe("KML de ubicaciones", () => {
    it("escapa los cinco caracteres especiales de XML", () => {
        expect(escaparXml(`Pérez & Hijos <"Café"> 'Sur'`)).toBe(
            "Pérez &amp; Hijos &lt;&quot;Café&quot;&gt; &apos;Sur&apos;",
        );
    });

    it("quita los caracteres de control que XML 1.0 no admite", () => {
        expect(escaparXml("Ana\u0000 Muñoz\u0008")).toBe("Ana Muñoz");
    });

    it("un productor con & o < en el nombre no rompe el archivo", () => {
        const kml = construirKml("SOL-1", [
            {
                nombre: "Finca <El Edén> & Cía",
                descripcion: "A & B",
                latitud: 1.85,
                longitud: -76.05,
                altitudMsnm: 1300,
            },
        ]);

        expect(kml).toContain("<name>Finca &lt;El Edén&gt; &amp; Cía</name>");
        expect(kml).toContain("<description>A &amp; B</description>");
        expect(kml).not.toMatch(/<name>[^<]*&(?!amp;|lt;|gt;|quot;|apos;)/);
    });

    it("escribe las coordenadas en orden longitud,latitud,altitud con altitudeMode absolute", () => {
        const kml = construirKml("SOL-1", [
            { nombre: "x", descripcion: "y", latitud: 1.85, longitud: -76.05, altitudMsnm: 1300.5 },
        ]);

        expect(kml).toContain("<coordinates>-76.05,1.85,1300.5</coordinates>");
        expect(kml).toContain("<altitudeMode>absolute</altitudeMode>");
    });

    it("sin altitud pega el punto al terreno en vez de ponerlo a nivel del mar", () => {
        const kml = construirKml("SOL-1", [
            { nombre: "x", descripcion: "y", latitud: 1.85, longitud: -76.05, altitudMsnm: null },
        ]);

        expect(kml).toContain("<altitudeMode>clampToGround</altitudeMode>");
        expect(kml).not.toContain("absolute");
    });

    it("genera un Placemark por punto dentro de un solo Document", () => {
        const punto = { nombre: "x", descripcion: "y", latitud: 1, longitud: 2, altitudMsnm: 3 };
        const kml = construirKml("Mapa", [punto, punto, punto]);

        expect(kml.match(/<Placemark>/g)).toHaveLength(3);
        expect(kml.match(/<Document>/g)).toHaveLength(1);
        expect(kml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    });
});
