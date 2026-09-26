import { Solicitud, SolicitudAppInvalidaError, type DatosSolicitudApp } from "./solicitud.entity";
import { FotoSolicitud } from "./foto-solicitud.entity";
import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

const PRODUCTOR = { id: "p-1", municipio: "Pitalito", vereda: "El Cedro", finca: "La Esperanza" };

const fotos = (cantidad: number) =>
    Array.from({ length: cantidad }, (_, indice) => ({
        id: `f-${indice + 1}`,
        idCliente: `img-${indice + 1}`,
        angulo: "HAZ" as const,
    }));

const datos = (cambios: Partial<DatosSolicitudApp> = {}): DatosSolicitudApp => ({
    id: "s-1",
    idCliente: "c-1",
    productor: PRODUCTOR,
    capturaId: null,
    cultivo: "CAFE",
    organo: "HOJA",
    nota: null,
    fecha: new Date(1_750_000_000_000),
    ubicacion: null,
    fotos: fotos(2),
    ...cambios,
});

const codigoDeRechazo = (cambios: Partial<DatosSolicitudApp>): string | null => {
    try {
        Solicitud.crearDesdeApp(datos(cambios));
        return null;
    } catch (error) {
        expect(error).toBeInstanceOf(SolicitudAppInvalidaError);
        expect(error).toBeInstanceOf(ReglaNegocioError);
        return (error as SolicitudAppInvalidaError).codigo;
    }
};

describe("Solicitud desde la app móvil", () => {
    describe("crearDesdeApp", () => {
        it("crea la solicitud Pendiente con la ubicación del productor y sin datos de IA", () => {
            const { solicitud, fotos: creadas } = Solicitud.crearDesdeApp(
                datos({
                    nota: "  Manchas amarillas  ",
                    ubicacion: { latitud: 1.85, longitud: -76.05, precisionMetros: 8 },
                }),
            );

            expect(solicitud.estado).toBe("Pendiente");
            expect(solicitud.productorId).toBe("p-1");
            expect([solicitud.municipio, solicitud.vereda, solicitud.finca]).toEqual([
                "Pitalito",
                "El Cedro",
                "La Esperanza",
            ]);
            expect(solicitud.confianzaIa).toBeNull();
            expect(solicitud.modeloVersionId).toBeNull();
            expect(solicitud.nota).toBe("Manchas amarillas");
            expect([solicitud.latitud, solicitud.longitud, solicitud.precisionMetros]).toEqual([1.85, -76.05, 8]);
            expect(creadas.map((foto) => foto.orden)).toEqual([1, 2]);
            expect(creadas.every((foto) => foto.solicitudId === "s-1" && !foto.estaSubida())).toBe(true);
        });

        it("acepta entre 2 y 5 fotos, aunque repitan ángulo", () => {
            expect(codigoDeRechazo({ fotos: fotos(2) })).toBeNull();
            expect(codigoDeRechazo({ fotos: fotos(5) })).toBeNull();
        });

        it("rechaza menos de 2 fotos", () => {
            expect(codigoDeRechazo({ fotos: fotos(1) })).toBe("imagenes_insuficientes");
        });

        it("rechaza más de 5 fotos", () => {
            expect(codigoDeRechazo({ fotos: fotos(6) })).toBe("demasiadas_imagenes");
        });

        it("rechaza fotos con el mismo id", () => {
            const repetidas = fotos(2).map((foto) => ({ ...foto, idCliente: "img-1" }));
            expect(codigoDeRechazo({ fotos: repetidas })).toBe("imagenes_repetidas");
        });

        it("acepta una nota de 500 caracteres y rechaza una más larga", () => {
            expect(codigoDeRechazo({ nota: "a".repeat(500) })).toBeNull();
            expect(codigoDeRechazo({ nota: "a".repeat(501) })).toBe("nota_muy_larga");
        });

        it("guarda una nota vacía como null", () => {
            expect(Solicitud.crearDesdeApp(datos({ nota: "   " })).solicitud.nota).toBeNull();
        });

        it.each([
            { latitud: 91, longitud: 0 },
            { latitud: -90.5, longitud: 0 },
            { latitud: 0, longitud: 180.1 },
            { latitud: 0, longitud: -181 },
        ])("rechaza coordenadas fuera de rango %o", (coordenadas) => {
            expect(codigoDeRechazo({ ubicacion: { ...coordenadas, precisionMetros: null } })).toBe(
                "ubicacion_invalida",
            );
        });

        it("acepta coordenadas en los límites", () => {
            expect(codigoDeRechazo({ ubicacion: { latitud: -90, longitud: 180, precisionMetros: null } })).toBeNull();
        });
    });

    describe("marcarEnviada", () => {
        const crear = () => Solicitud.crearDesdeApp(datos({ fotos: fotos(3) }));

        it("pasa a Enviada cuando todas las fotos están subidas", () => {
            const { solicitud, fotos: creadas } = crear();
            creadas.forEach((foto) => foto.marcarSubida(`solicitudes/s-1/${foto.id}.jpg`, "image/jpeg", 100));

            solicitud.marcarEnviada(creadas);

            expect(solicitud.estado).toBe("Enviada");
        });

        it("no pasa a Enviada si falta alguna foto", () => {
            const { solicitud, fotos: creadas } = crear();
            creadas.slice(0, 2).forEach((foto) => foto.marcarSubida("ruta.jpg", "image/jpeg", 100));

            expect(solicitud.puedeMarcarseEnviada(creadas)).toBe(false);
            expect(() => solicitud.marcarEnviada(creadas)).toThrow(ReglaNegocioError);
            expect(solicitud.estado).toBe("Pendiente");
        });

        it("no vuelve a enviar una solicitud que ya salió de Pendiente", () => {
            const { solicitud, fotos: creadas } = crear();
            creadas.forEach((foto) => foto.marcarSubida("ruta.jpg", "image/jpeg", 100));
            solicitud.marcarEnviada(creadas);

            expect(() => solicitud.marcarEnviada(creadas)).toThrow(ReglaNegocioError);
        });
    });

    describe("FotoSolicitud", () => {
        it("registra la subida una sola vez", () => {
            const foto = new FotoSolicitud("f-1", "s-1", "img-1", "ENVES", 1);

            foto.marcarSubida("solicitudes/s-1/a.jpg", "image/jpeg", 2048);

            expect(foto.estaSubida()).toBe(true);
            expect(foto.subidaEn).toBeInstanceOf(Date);
            expect(() => foto.marcarSubida("otra.jpg", "image/jpeg", 1)).toThrow(ReglaNegocioError);
        });
    });
});
