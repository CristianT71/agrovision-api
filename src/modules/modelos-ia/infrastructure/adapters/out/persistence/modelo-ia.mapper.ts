import { ModeloIa, type Canal, type FormatoModelo } from "../../../../domain/entities/modelo-ia.entity";
import type { TypeOrmModeloIaEntity } from "./typeorm-modelo-ia.entity";

// Mapper: Convierte el Esquema de TypeORM a Entidad pura de Dominio
export function modeloADominio(entity: TypeOrmModeloIaEntity): ModeloIa {
    return new ModeloIa(
        entity.id,
        entity.version,
        entity.formato as FormatoModelo,
        entity.canal as Canal,
        entity.versionMinApp,
        entity.notas,
        {
            rutaModelo: entity.rutaModelo,
            rutaEtiquetas: entity.rutaEtiquetas,
            rutaCalibracion: entity.rutaCalibracion,
            tamanoBytes: entity.tamanoBytes,
            sha256: entity.sha256,
            firma: entity.firma,
            numeroClases: entity.numeroClases,
        },
        entity.creadoPor,
        entity.fechaCreacion,
        entity.fechaPublicacion,
        entity.porcentajeCanario,
        entity.killSwitch,
        entity.motivoKillSwitch,
        entity.fechaKillSwitch,
    );
}

export function modeloAPersistencia(modelo: ModeloIa): TypeOrmModeloIaEntity {
    return {
        id: modelo.id,
        version: modelo.version,
        formato: modelo.formato,
        canal: modelo.canal,
        versionMinApp: modelo.versionMinApp,
        notas: modelo.notas,
        rutaModelo: modelo.artefactos.rutaModelo,
        rutaEtiquetas: modelo.artefactos.rutaEtiquetas,
        rutaCalibracion: modelo.artefactos.rutaCalibracion,
        tamanoBytes: modelo.artefactos.tamanoBytes,
        sha256: modelo.artefactos.sha256,
        firma: modelo.artefactos.firma,
        numeroClases: modelo.artefactos.numeroClases,
        activo: modelo.estaActivo(),
        creadoPor: modelo.creadoPor,
        fechaCreacion: modelo.fechaCreacion,
        fechaPublicacion: modelo.fechaPublicacion,
        porcentajeCanario: modelo.porcentajeCanario,
        killSwitch: modelo.killSwitch,
        motivoKillSwitch: modelo.motivoKillSwitch,
        fechaKillSwitch: modelo.fechaKillSwitch,
    };
}
