import { Inject, Injectable } from "@nestjs/common";
import type {
    Actor,
    IObtenerPermisoContactoUseCase,
    PermisoContactoVista,
} from "../../domain/ports/in/gestionar-permisos-contacto.port";
import {
    PERMISO_CONTACTO_REPOSITORY,
    type IPermisoContactoRepository,
} from "../../domain/ports/out/permiso-contacto.repository";
import { CONSULTA_SOLICITUDES, type IConsultaSolicitudes } from "../../domain/ports/out/consulta-solicitudes.port";
import { CONSULTA_AGRONOMOS, type IConsultaAgronomos } from "../../domain/ports/out/consulta-agronomos.port";
import { resolverAcceso } from "./resolver-acceso";
import { aPermisoContactoVista } from "./permiso-contacto-vista";

@Injectable()
export class ObtenerPermisoContactoService implements IObtenerPermisoContactoUseCase {
    constructor(
        @Inject(PERMISO_CONTACTO_REPOSITORY)
        private readonly permisoRepository: IPermisoContactoRepository,
        @Inject(CONSULTA_SOLICITUDES)
        private readonly consultaSolicitudes: IConsultaSolicitudes,
        @Inject(CONSULTA_AGRONOMOS)
        private readonly consultaAgronomos: IConsultaAgronomos,
    ) {}

    async ejecutar(consulta: { actor: Actor; solicitudId: string }): Promise<PermisoContactoVista> {
        const { contexto } = await resolverAcceso(
            consulta.actor,
            consulta.solicitudId,
            this.consultaSolicitudes,
            this.consultaAgronomos,
        );

        // Consultar no crea filas: sin permiso registrado se responde como no otorgado
        const permiso = await this.permisoRepository.findBySolicitudId(consulta.solicitudId);

        return aPermisoContactoVista(permiso, contexto);
    }
}
