import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
    Actor,
    ContactoProductorVista,
    IObtenerContactoProductorUseCase,
} from "../../domain/ports/in/gestionar-permisos-contacto.port";
import {
    PERMISO_CONTACTO_REPOSITORY,
    type IPermisoContactoRepository,
} from "../../domain/ports/out/permiso-contacto.repository";
import { CONSULTA_SOLICITUDES, type IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import { CONSULTA_AGRONOMOS, type IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import { CONSULTA_PRODUCTORES, type IConsultaProductores } from "../../domain/ports/out/consulta-productores.port";
import { resolverAcceso } from "./resolver-acceso";

@Injectable()
export class ObtenerContactoProductorService implements IObtenerContactoProductorUseCase {
    constructor(
        @Inject(PERMISO_CONTACTO_REPOSITORY)
        private readonly permisoRepository: IPermisoContactoRepository,
        @Inject(CONSULTA_SOLICITUDES)
        private readonly consultaSolicitudes: IConsultaSolicitudes,
        @Inject(CONSULTA_AGRONOMOS)
        private readonly consultaAgronomos: IConsultaAgronomos,
        @Inject(CONSULTA_PRODUCTORES)
        private readonly consultaProductores: IConsultaProductores,
    ) {}

    async ejecutar(consulta: { actor: Actor; solicitudId: string }): Promise<ContactoProductorVista> {
        // 1. Solo el administrador y el agrónomo asignado llegan hasta aquí
        const { contexto, agronomoId } = await resolverAcceso(
            consulta.actor,
            consulta.solicitudId,
            this.consultaSolicitudes,
            this.consultaAgronomos,
        );

        // 2. RF-04.10: el agrónomo necesita el permiso expreso otorgado a él.
        // El administrador no: es quien otorga el permiso y ya administra los productores (RF-10.1).
        if (agronomoId) {
            const permiso = await this.permisoRepository.findBySolicitudId(consulta.solicitudId);

            if (!permiso?.estaVigentePara(agronomoId)) {
                throw new ForbiddenException(
                    "El administrador no ha habilitado el contacto con el productor de esta solicitud.",
                );
            }
        }

        // 3. Solo se leen los datos de contacto, nunca el perfil completo
        const contacto = await this.consultaProductores.obtenerContacto(contexto.productorId);

        if (!contacto) {
            throw new NotFoundException("El productor de esta solicitud no fue encontrado.");
        }

        return { solicitudId: contexto.id, productorNombre: contacto.nombre, telefono: contacto.telefono };
    }
}
