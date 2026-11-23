import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
    MAX_PUNTOS_MAPA,
    type FiltrosMapa,
    type IListarMapaSolicitudesUseCase,
    type MapaSolicitudes,
} from "../../domain/ports/in/ubicacion-solicitudes.port";
import { LECTURA_SOLICITUDES, type ILecturaSolicitudes } from "../../domain/ports/out/lectura-solicitudes.port";
import {
    AUDITORIA_UBICACIONES,
    type AccionAuditoriaUbicacion,
    type IAuditoriaUbicaciones,
} from "../../domain/ports/out/auditoria-ubicaciones.port";
import { construirKml } from "../../domain/services/kml-ubicaciones";

type Usuario = { id: string; rol: string };

// Mapa de casos del administrador. No consulta elevación: usa la altitud que ya está guardada, para que
// el listado sea una sola consulta indexada (RNF-03.1).
@Injectable()
export class ListarMapaSolicitudesService implements IListarMapaSolicitudesUseCase {
    constructor(
        @Inject(LECTURA_SOLICITUDES)
        private readonly lecturaSolicitudes: ILecturaSolicitudes,
        @Inject(AUDITORIA_UBICACIONES)
        private readonly auditoria: IAuditoriaUbicaciones,
    ) {}

    async ejecutar(usuario: Usuario, filtros: FiltrosMapa): Promise<MapaSolicitudes> {
        return await this.consultar(usuario, filtros, "mapa_listado");
    }

    async ejecutarKml(usuario: Usuario, filtros: FiltrosMapa): Promise<{ nombreArchivo: string; kml: string }> {
        const { puntos } = await this.consultar(usuario, filtros, "mapa_kml");

        const kml = construirKml(
            "Mapa de casos AgroVisión",
            puntos.map((punto) => ({
                nombre: `SOL-${punto.solicitudId.slice(0, 8).toUpperCase()}`,
                descripcion: [
                    `Productor: ${punto.productorNombre ?? "sin nombre"}`,
                    `Finca: ${punto.finca} (${punto.vereda}, ${punto.municipio})`,
                    `Estado: ${punto.estado}`,
                    punto.altitudMsnm === null ? "Altitud: sin dato" : `Altitud: ${punto.altitudMsnm} msnm`,
                    punto.simulada ? "Atención: ubicación marcada como simulada" : "",
                ]
                    .filter(Boolean)
                    .join("\n"),
                latitud: punto.latitud,
                longitud: punto.longitud,
                altitudMsnm: punto.altitudMsnm,
            })),
        );

        return { nombreArchivo: "mapa-solicitudes.kml", kml };
    }

    private async consultar(
        usuario: Usuario,
        filtros: FiltrosMapa,
        accion: AccionAuditoriaUbicacion,
    ): Promise<MapaSolicitudes> {
        // El controlador ya exige admin; se repite aquí porque este caso de uso también lo podría llamar otro módulo
        if (usuario.rol !== "admin") {
            throw new ForbiddenException("El mapa de casos es solo para administradores.");
        }

        if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
            throw new BadRequestException("La fecha 'desde' no puede ser posterior a 'hasta'.");
        }

        // Una fila de más: si llega, había más casos que el límite y el mapa va recortado
        const filas = await this.lecturaSolicitudes.listarMapa(filtros, MAX_PUNTOS_MAPA + 1);
        const truncado = filas.length > MAX_PUNTOS_MAPA;
        const puntos = truncado ? filas.slice(0, MAX_PUNTOS_MAPA) : filas;

        // Una sola entrada por consulta, con los filtros tal como se aplicaron
        await this.auditoria.registrar({
            accion,
            actorUsuarioId: usuario.id,
            solicitudId: null,
            filtros: {
                estado: filtros.estado,
                agronomoId: filtros.agronomoId,
                cultivo: filtros.cultivo,
                municipio: filtros.municipio,
                desde: filtros.desde?.toISOString(),
                hasta: filtros.hasta?.toISOString(),
            },
            resultados: puntos.length,
        });

        return { puntos, truncado, limite: MAX_PUNTOS_MAPA };
    }
}
