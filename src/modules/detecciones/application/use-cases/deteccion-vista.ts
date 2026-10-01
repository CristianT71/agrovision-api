import { BadRequestException } from "@nestjs/common";
import type { DeteccionVista } from "../../domain/ports/in/monitor-detecciones.port";
import type { DeteccionLeida, FiltrosDetecciones } from "../../domain/ports/out/lectura-detecciones.port";
import { evaluarDivergencia } from "../../domain/services/divergencia";

export function aDeteccionVista(leida: DeteccionLeida): DeteccionVista {
    const { deteccion: d } = leida;

    return {
        id: d.id,
        idCliente: d.idCliente,
        productorId: d.productorId,
        productorNombre: leida.productorNombre,
        municipio: d.municipio,
        categoria: d.categoria,
        clasePredicha: d.clasePredicha,
        confianza: d.confianza,
        puntajeOod: d.puntajeOod,
        resultadoCompuerta: d.resultadoCompuerta,
        modeloId: d.modeloId,
        modeloVersion: d.modeloVersion,
        cultivo: d.cultivo,
        organo: d.organo,
        latitud: d.latitud,
        longitud: d.longitud,
        fecha: d.fecha,
        recibidaEn: d.recibidaEn,
        defectuosa: d.defectuosa,
        revision: {
            ...evaluarDivergencia(d, {
                correccionProductor: d.correccionProductor,
                confirmadaProductor: d.confirmadaProductor,
                resultadoAgronomo: leida.resultadoAgronomo,
            }),
            correccionProductor: d.correccionProductor,
            confirmadaProductor: d.confirmadaProductor,
            solicitudId: leida.solicitudId,
            resultadoAgronomo: leida.resultadoAgronomo,
            plagaAgronomo: leida.plagaAgronomo,
        },
    };
}

// Combinaciones que nunca devolverían nada: mejor avisar que responder una lista vacía
export function validarFiltros(filtros: FiltrosDetecciones): void {
    const repetidas = (filtros.incluir ?? []).filter((categoria) => filtros.excluir?.includes(categoria));
    if (repetidas.length > 0) {
        throw new BadRequestException(`No se puede incluir y excluir a la vez: ${repetidas.join(", ")}.`);
    }

    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
        throw new BadRequestException("La fecha desde no puede ser posterior a la fecha hasta.");
    }
}
