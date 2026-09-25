import { Agronomo, EstadoAgronomo } from "../../entities/agronomo.entity";
import { DocumentoAcreditacion } from "../../entities/documento-acreditacion.entity";
import type { Usuario } from "../../../../autenticacion/domain/entities/usuario.entity";

export interface FiltrosAgronomo {
    estado?: EstadoAgronomo;
    especialidad?: string;
}

export interface IAgronomoRepository {
    findById(id: string): Promise<Agronomo | null>;
    findByUsuarioId(usuarioId: string): Promise<Agronomo | null>;
    findByTarjetaProfesional(tarjeta: string): Promise<Agronomo | null>;
    findByCorreo(correo: string): Promise<Agronomo | null>;
    findAll(filtros?: FiltrosAgronomo): Promise<Agronomo[]>;
    // El teléfono es el login: no puede repetirse con ninguna otra cuenta (usuarios)
    existeCuentaConTelefono(telefono: string): Promise<boolean>;
    // RF-01.6 / RF-10.4: crea la cuenta, el agrónomo y sus documentos en una sola transacción
    registrar(agronomo: Agronomo, usuario: Usuario, documentos: DocumentoAcreditacion[]): Promise<void>;
    // Guarda el agrónomo y replica su estado en la cuenta de login (usuarios.estado)
    guardar(agronomo: Agronomo): Promise<Agronomo>;
    findDocumentos(agronomoId: string): Promise<DocumentoAcreditacion[]>;
    findDocumento(agronomoId: string, documentoId: string): Promise<DocumentoAcreditacion | null>;
    // RF-08.4: casos en curso (solicitudes "Asignada") de cada agrónomo
    contarCasosActivos(agronomoIds: string[]): Promise<Map<string, number>>;
}

// Token de inyección PARA dependencias de NestJS
export const AGRONOMO_REPOSITORY = "AGRONOMO_REPOSITORY";
