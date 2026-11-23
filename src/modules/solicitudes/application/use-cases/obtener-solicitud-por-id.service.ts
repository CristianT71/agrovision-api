import { Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { IObtenerSolicitudPorIdUseCase, SolicitudVista } from "../../domain/ports/in/consultar-solicitudes.port";
import { LECTURA_SOLICITUDES, type ILecturaSolicitudes } from "../../domain/ports/out/lectura-solicitudes.port";
import {
    CAPTURA_MODELO_REPOSITORY,
    type ICapturaModeloRepository,
} from "../../domain/ports/out/captura-modelo.repository";
import { VerificarAccesoSolicitudService } from "./verificar-acceso-solicitud.service";

@Injectable()
export class ObtenerSolicitudPorIdService implements IObtenerSolicitudPorIdUseCase {
    constructor(
        @Inject(LECTURA_SOLICITUDES)
        private readonly lecturaSolicitudes: ILecturaSolicitudes,
        private readonly verificarAcceso: VerificarAccesoSolicitudService,
        @Optional()
        @Inject(CAPTURA_MODELO_REPOSITORY)
        private readonly capturaModelo?: ICapturaModeloRepository,
    ) {}

    // Detalle del panel: la verificación ya trae la solicitud, no se vuelve a consultar
    async ejecutar(usuario: { id: string; rol: string }, id: string): Promise<SolicitudVista> {
        const { solicitud, productorNombre, autorizacionDatos } = await this.verificarAcceso.ejecutar(usuario, id);

        // Versión legible del modelo (1.3.2); el agrónomo no puede consultar /modelos, que es de admin
        const modeloVersion = (await this.capturaModelo?.obtenerVersionPorModeloId(solicitud.modeloVersionId)) ?? null;

        return Object.assign(solicitud.sinUbicacion(), {
            productorNombre,
            tieneUbicacion: solicitud.tieneUbicacion(),
            modeloVersion,
            autorizacionDatos: autorizacionDatos ?? null,
        });
    }

    // Solo para otros módulos (mensajería, permisos de contacto), que aplican su propio control
    // de acceso. Nunca se expone por HTTP.
    async obtenerInterno(id: string): Promise<SolicitudVista> {
        const resultado = await this.lecturaSolicitudes.obtener(id);

        if (!resultado) {
            throw new NotFoundException(`La solicitud con ID ${id} no fue encontrada.`);
        }

        return Object.assign(resultado.solicitud.sinUbicacion(), {
            productorNombre: resultado.productorNombre,
            tieneUbicacion: resultado.solicitud.tieneUbicacion(),
        });
    }
}
