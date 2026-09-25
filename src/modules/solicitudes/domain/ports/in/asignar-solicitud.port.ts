import type { Solicitud } from "../../entities/solicitud.entity";

export interface AsignarSolicitudCommand {
    solicitudId: string;
    agronomoId: string;
}

export interface IAsignarSolicitudUseCase {
    ejecutar(comando: AsignarSolicitudCommand): Promise<Solicitud>;
}
