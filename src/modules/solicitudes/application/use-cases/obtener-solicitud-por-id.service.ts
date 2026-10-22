import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { IObtenerSolicitudPorIdUseCase, SolicitudVista } from "../../domain/ports/in/consultar-solicitudes.port";
import { LECTURA_SOLICITUDES, type ILecturaSolicitudes } from "../../domain/ports/out/lectura-solicitudes.port";
import { VerificarAccesoSolicitudService } from "./verificar-acceso-solicitud.service";

@Injectable()
export class ObtenerSolicitudPorIdService implements IObtenerSolicitudPorIdUseCase {
    constructor(
        @Inject(LECTURA_SOLICITUDES)
        private readonly lecturaSolicitudes: ILecturaSolicitudes,
        private readonly verificarAcceso: VerificarAccesoSolicitudService,
    ) {}

    // Detalle del panel: la verificación ya trae la solicitud, no se vuelve a consultar
    async ejecutar(usuario: { id: string; rol: string }, id: string): Promise<SolicitudVista> {
        const { solicitud, productorNombre } = await this.verificarAcceso.ejecutar(usuario, id);

        return Object.assign(solicitud, { productorNombre });
    }

    // Solo para otros módulos (mensajería, permisos de contacto), que aplican su propio control
    // de acceso. Nunca se expone por HTTP.
    async obtenerInterno(id: string): Promise<SolicitudVista> {
        const resultado = await this.lecturaSolicitudes.obtener(id);

        if (!resultado) {
            throw new NotFoundException(`La solicitud con ID ${id} no fue encontrada.`);
        }

        return Object.assign(resultado.solicitud, { productorNombre: resultado.productorNombre });
    }
}
