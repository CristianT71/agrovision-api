import type { Solicitud } from "../../entities/solicitud.entity";

export interface AsignarSolicitudCommand {
    solicitudId: string;
    agronomoId: string;
    // RF-08.4: si el agrónomo superaría la carga máxima, el administrador debe confirmarlo
    confirmarSobrecarga?: boolean;
}

export interface IAsignarSolicitudUseCase {
    ejecutar(comando: AsignarSolicitudCommand): Promise<Solicitud>;
}
