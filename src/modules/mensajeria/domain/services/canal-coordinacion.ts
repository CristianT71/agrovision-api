import { ReglaNegocioError } from "../../../../common/errors/regla-negocio.error";

// Datos de la solicitud que el canal necesita para decidir si admite mensajes
export interface ContextoSolicitud {
    id: string;
    agronomoId: string | null;
    estado: string;
}

// Regla de Negocio (RF-08.7): sin evaluador asignado no hay canal que coordinar.
// La lectura del historial sí se permite en solicitudes resueltas o descartadas.
export function validarEnvio(contexto: ContextoSolicitud): void {
    if (!contexto.agronomoId) {
        throw new ReglaNegocioError("No se pueden enviar mensajes a una solicitud sin agrónomo asignado.");
    }

    if (contexto.estado === "Resuelta" || contexto.estado === "Descartada") {
        throw new ReglaNegocioError("El canal de coordinación de esta solicitud está cerrado.");
    }
}
