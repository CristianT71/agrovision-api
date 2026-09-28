// El JWT trae el id de usuarios, pero solicitudes.agronomo_id apunta a agronomos.id:
// este puerto hace esa traducción para poder comparar el evaluador asignado.
export interface IConsultaAgronomos {
    obtenerAgronomoIdPorUsuario(usuarioId: string): Promise<string | null>;
}

// Token de inyección PARA dependencias de NestJS
export const CONSULTA_AGRONOMOS = "CONSULTA_AGRONOMOS";
