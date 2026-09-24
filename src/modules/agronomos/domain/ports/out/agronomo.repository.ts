import { Agronomo, EstadoAgronomo } from "../../entities/agronomo.entity";

export interface FiltrosAgronomo {
    estado?: EstadoAgronomo;
    especialidad?: string;
}

export interface IAgronomoRepository {
    findById(id: string): Promise<Agronomo | null>;
    findByUsuarioId(usuarioId: string): Promise<Agronomo | null>;
    findByTarjetaProfesional(tarjeta: string): Promise<Agronomo | null>;
    findAll(filtros?: FiltrosAgronomo): Promise<Agronomo[]>;
    guardar(agronomo: Agronomo): Promise<Agronomo>;
}

// Token de inyección PARA dependencias de NestJS
export const AGRONOMO_REPOSITORY = "AGRONOMO_REPOSITORY";
