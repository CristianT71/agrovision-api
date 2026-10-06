import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
    CasoPlagaNueva,
    IResumirResolucionesUseCase,
    ResumenResoluciones,
} from "../../domain/ports/in/tablero-resoluciones.port";
import {
    LECTURA_SOLICITUDES,
    type ILecturaSolicitudes,
    type SolicitudConProductor,
} from "../../domain/ports/out/lectura-solicitudes.port";
import {
    agruparPorDia,
    alcanzaUmbralPlagaNueva,
    completarPorTipo,
    DIAS_VENTANA_RESOLUCIONES,
    inicioSemanaAlerta,
    MAX_CASOS_PLAGA_NUEVA,
    UMBRAL_PLAGA_NUEVA_SEMANAL,
} from "../../domain/services/resoluciones";
import { resolverVentana } from "../../../../common/utils/ventana-tiempo";

// RF-06.5 a RF-06.7: tablero de resoluciones del administrador. Trae datos del productor de cada
// caso, así que no aplica al agrónomo, que solo ve lo que tiene asignado.
@Injectable()
export class ResumirResolucionesService implements IResumirResolucionesUseCase {
    constructor(
        @Inject(LECTURA_SOLICITUDES)
        private readonly lecturaSolicitudes: ILecturaSolicitudes,
    ) {}

    async ejecutar(
        usuario: { id: string; rol: string },
        consulta: { desde?: Date; hasta?: Date },
    ): Promise<ResumenResoluciones> {
        if (usuario.rol !== "admin") {
            throw new ForbiddenException("El tablero de resoluciones es solo para el administrador.");
        }

        // Misma validación que /telemetria/resumen: máximo 90 días; por defecto, los últimos 30
        const ahora = new Date();
        const ventana = resolverVentana(consulta.desde, consulta.hasta, ahora, DIAS_VENTANA_RESOLUCIONES);

        const [porTipoCrudo, fechasPlagaNueva, recientes, casosUltimaSemana] = await Promise.all([
            this.lecturaSolicitudes.contarResueltasPorTipo(ventana),
            this.lecturaSolicitudes.fechasPlagaNueva(ventana),
            this.lecturaSolicitudes.listarPlagaNueva(ventana, MAX_CASOS_PLAGA_NUEVA),
            this.lecturaSolicitudes.contarPlagaNuevaDesde(inicioSemanaAlerta(ahora)),
        ]);

        const porTipo = completarPorTipo(porTipoCrudo);

        return {
            desde: ventana.desde,
            hasta: ventana.hasta,
            total: porTipo.reduce((suma, fila) => suma + fila.casos, 0),
            porTipo,
            plagasNuevas: {
                umbral: UMBRAL_PLAGA_NUEVA_SEMANAL,
                casosUltimaSemana,
                alertaActiva: alcanzaUmbralPlagaNueva(casosUltimaSemana),
                serie: agruparPorDia(fechasPlagaNueva),
                casos: recientes.map(aCasoPlagaNueva),
            },
        };
    }
}

function aCasoPlagaNueva({ solicitud, productorNombre }: SolicitudConProductor): CasoPlagaNueva {
    return {
        id: solicitud.id,
        plagaIdentificada: solicitud.plagaIdentificada,
        fechaResolucion: solicitud.fechaResolucion,
        productorNombre,
        finca: solicitud.finca,
        vereda: solicitud.vereda,
        municipio: solicitud.municipio,
        respuestaProfesional: solicitud.respuestaProfesional,
    };
}
