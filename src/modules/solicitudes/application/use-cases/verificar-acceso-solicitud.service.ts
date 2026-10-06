import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    LECTURA_SOLICITUDES,
    type ILecturaSolicitudes,
    type SolicitudConProductor,
} from "../../domain/ports/out/lectura-solicitudes.port";
import { AGRONOMO_REPOSITORY, type IAgronomoRepository } from "../../../agronomos/domain/ports/out/agronomo.repository";

// La solicitud ya leída, para que quien verifica no tenga que volver a consultarla
export interface AccesoSolicitud extends SolicitudConProductor {
    // Agrónomo de quien consulta; null cuando es el administrador
    agronomoId: string | null;
}

// Control de acceso del panel (RF-03.3, RF-08.3): el administrador ve cualquier solicitud;
// el agrónomo solo las que tiene asignadas, porque está para responder lo que se le delega
@Injectable()
export class VerificarAccesoSolicitudService {
    constructor(
        @Inject(LECTURA_SOLICITUDES)
        private readonly lecturaSolicitudes: ILecturaSolicitudes,
        @Inject(AGRONOMO_REPOSITORY)
        private readonly agronomoRepository: IAgronomoRepository,
    ) {}

    async ejecutar(usuario: { id: string; rol: string }, solicitudId: string): Promise<AccesoSolicitud> {
        if (usuario.rol === "admin") {
            return { ...(await this.obtener(solicitudId)), agronomoId: null };
        }

        if (usuario.rol !== "agronomo") {
            throw new ForbiddenException("No tienes acceso a esta solicitud.");
        }

        const agronomoId = await obtenerAgronomoIdDeCuenta(this.agronomoRepository, usuario.id);

        // Una solicitud ajena o sin asignar responde igual que una inexistente: no se revela que existe
        const resultado = await this.obtener(solicitudId);
        if (resultado.solicitud.agronomoId !== agronomoId) {
            throw this.noEncontrada(solicitudId);
        }

        return { ...resultado, agronomoId };
    }

    private async obtener(solicitudId: string): Promise<SolicitudConProductor> {
        const resultado = await this.lecturaSolicitudes.obtener(solicitudId);
        if (!resultado) {
            throw this.noEncontrada(solicitudId);
        }

        return resultado;
    }

    private noEncontrada(solicitudId: string): NotFoundException {
        return new NotFoundException(`La solicitud con ID ${solicitudId} no fue encontrada.`);
    }
}

// El agrónomo de una cuenta, tomado del token y nunca de lo que mande el cliente.
// La comparten la bandeja, los contadores y el acceso a cada solicitud.
export async function obtenerAgronomoIdDeCuenta(
    agronomoRepository: IAgronomoRepository,
    usuarioId: string,
): Promise<string> {
    const agronomo = await agronomoRepository.findByUsuarioId(usuarioId);
    if (!agronomo) {
        throw new ForbiddenException("No existe un perfil de agrónomo asociado a esta cuenta.");
    }

    return agronomo.id;
}
