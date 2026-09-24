import type { TipoResultado } from "../../entities/solicitud.entity";

export interface ResolverSolicitudCommand {
    solicitudId: string;
    // Usuario autenticado que resuelve: se toma del token, nunca del cuerpo de la petición
    usuarioId: string;
    respuestaProfesional: string;
    tipoResultado: TipoResultado;
    plagaIdentificada: string;
}

export interface IResolverSolicitudUseCase {
    ejecutar(comando: ResolverSolicitudCommand): Promise<void>;
}
