import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { construirKml } from "../../../solicitudes/domain/services/kml-ubicaciones";
import { LECTURA_DETECCIONES, type ILecturaDetecciones } from "../../domain/ports/out/lectura-detecciones.port";

// KML de una detección para Google Earth. Solo lectura: no registra auditoría de ubicaciones, que es de las solicitudes.
@Injectable()
export class ObtenerKmlDeteccionService {
    constructor(
        @Inject(LECTURA_DETECCIONES)
        private readonly lecturaDetecciones: ILecturaDetecciones,
    ) {}

    async ejecutar(id: string): Promise<{ nombreArchivo: string; kml: string }> {
        const leida = await this.lecturaDetecciones.obtener(id);

        if (!leida) {
            throw new NotFoundException(`La detección con ID ${id} no fue encontrada.`);
        }

        const { deteccion: d } = leida;

        if (d.latitud === null || d.longitud === null) {
            throw new NotFoundException("La detección no tiene ubicación.");
        }

        const descripcion = [
            `Categoría: ${d.categoria}`,
            d.confianza !== null ? `Confianza: ${(d.confianza * 100).toFixed(1)}%` : null,
            `Productor: ${leida.productorNombre ?? "Sin perfil"} (${d.municipio})`,
            `Capturada: ${d.fecha.toISOString()}`,
            d.precisionMetros !== null ? `Precisión del GPS: ± ${Math.round(d.precisionMetros)} m` : null,
        ]
            .filter(Boolean)
            .join("\n");

        const nombre = `Detección ${d.clasePredicha ?? d.categoria}`;

        return {
            nombreArchivo: `deteccion-${d.id.slice(0, 8)}.kml`,
            kml: construirKml(nombre, [
                { nombre, descripcion, latitud: d.latitud, longitud: d.longitud, altitudMsnm: null },
            ]),
        };
    }
}
