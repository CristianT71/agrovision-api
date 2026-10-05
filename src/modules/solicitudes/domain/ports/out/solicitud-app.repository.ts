import type { Solicitud } from "../../entities/solicitud.entity";
import type { FotoSolicitud } from "../../entities/foto-solicitud.entity";

// Persistencia de las solicitudes que crea la app móvil y de sus fotos
export interface ISolicitudAppRepository {
    findByIdCliente(idCliente: string): Promise<Solicitud | null>;
    // Inserta la solicitud y sus fotos en una sola transacción. Devuelve false si algún
    // id de la app ya existía (otra petición la creó primero o se repitió un id de foto).
    crearConFotos(solicitud: Solicitud, fotos: FotoSolicitud[]): Promise<boolean>;
    listarPorProductor(productorId: string, actualizadasDesde?: Date): Promise<Solicitud[]>;
    listarFotos(solicitudId: string): Promise<FotoSolicitud[]>;
    findFotoById(id: string): Promise<FotoSolicitud | null>;
    // Solo guarda si la foto sigue sin subir: devuelve false si otra subida llegó primero
    marcarFotoSubida(foto: FotoSolicitud): Promise<boolean>;
    // UPDATE condicionado a "Pendiente": devuelve false si otra petición ya la envió
    guardarEnvio(solicitud: Solicitud): Promise<boolean>;
}

// Token de inyección PARA dependencias de NestJS
export const SOLICITUD_APP_REPOSITORY = "SOLICITUD_APP_REPOSITORY";
