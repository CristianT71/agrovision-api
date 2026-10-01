import { ModeloIa, type Canal, type FormatoModelo } from "../../../../domain/entities/modelo-ia.entity";
import { MetricaModelo } from "../../../../domain/entities/metrica-modelo.entity";
import type { TypeOrmModeloIaEntity } from "./typeorm-modelo-ia.entity";
import type { TypeOrmMetricaModeloEntity } from "./typeorm-metrica-modelo.entity";

// La global primero y luego las clases en orden alfabético: el panel las muestra así
function metricasADominio(entities: TypeOrmMetricaModeloEntity[] = []): MetricaModelo[] {
    return entities
        .map((entity) => new MetricaModelo(entity.clase, entity.precision, entity.recall, entity.f1))
        .sort((a, b) => (a.clase === null ? -1 : b.clase === null ? 1 : a.clase.localeCompare(b.clase)));
}

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
        metricasADominio(entity.metricas),
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
