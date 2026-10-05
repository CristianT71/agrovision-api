import type { TipoResultado } from "../../entities/solicitud.entity";
import type { ArchivoParaGuardar } from "../../../../../common/almacenamiento/almacenamiento.port";

export interface ResolverSolicitudCommand {
    solicitudId: string;
    // Usuario autenticado que resuelve: se toma del token, nunca del cuerpo de la petición
    usuarioId: string;
    respuestaProfesional: string;
    tipoResultado: TipoResultado;
    plagaIdentificada: string;
    // RF-04.6: imágenes o PDF ya validados por su contenido real
    anexos?: ArchivoParaGuardar[];
}

export interface IResolverSolicitudUseCase {
    ejecutar(comando: ResolverSolicitudCommand): Promise<void>;
}
