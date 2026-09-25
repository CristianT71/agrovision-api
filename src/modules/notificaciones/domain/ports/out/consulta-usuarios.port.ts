// AutenticacionModule no exporta su repositorio ni busca cuentas por rol: notificaciones
// tiene su propio puerto de SOLO LECTURA sobre usuarios para avisar a todo un rol.
export interface IConsultaUsuarios {
    listarIdsActivosPorRol(rol: string): Promise<string[]>;
}

// Token de inyección PARA dependencias de NestJS
export const CONSULTA_USUARIOS = "CONSULTA_USUARIOS";
