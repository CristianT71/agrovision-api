// El JWT trae el id de usuarios, pero solicitudes.agronomo_id apunta a agronomos.id:
// este puerto hace esa traducción en los dos sentidos.
export interface IConsultaAgronomos {
    // Para comparar al actor con el evaluador asignado
    obtenerAgronomoIdPorUsuario(usuarioId: string): Promise<string | null>;
    // Para notificar al agrónomo en su cuenta de login
    obtenerUsuarioIdPorAgronomo(agronomoId: string): Promise<string | null>;
}

// Token de inyección PARA dependencias de NestJS
export const CONSULTA_AGRONOMOS = "CONSULTA_AGRONOMOS";
