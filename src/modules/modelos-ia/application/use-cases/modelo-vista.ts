import type { ModeloIa } from "../../domain/entities/modelo-ia.entity";
import type { ModeloVista } from "../../domain/ports/in/gestionar-modelos.port";
import type { AdopcionModelo } from "../../domain/ports/out/consulta-adopcion.port";

// "adopcion" solo se calcula en el inventario (listar y obtener); las respuestas de escritura no la traen
export function aModeloVista(modelo: ModeloIa, adopcion?: Map<string, AdopcionModelo>): ModeloVista {
    return {
        id: modelo.id,
        version: modelo.version,
        formato: modelo.formato,
        canal: modelo.canal,
        activo: modelo.estaActivo(),
        versionMinApp: modelo.versionMinApp,
        notas: modelo.notas,
        tamanoBytes: modelo.artefactos.tamanoBytes,
        sha256: modelo.artefactos.sha256,
        firmado: modelo.artefactos.firma !== null,
        numeroClases: modelo.artefactos.numeroClases,
        creadoPor: modelo.creadoPor,
        fechaCreacion: modelo.fechaCreacion,
        fechaPublicacion: modelo.fechaPublicacion,
        porcentajeCanario: modelo.porcentajeCanario,
        killSwitch: modelo.killSwitch,
        motivoKillSwitch: modelo.motivoKillSwitch,
        fechaKillSwitch: modelo.fechaKillSwitch,
        metricas: modelo.metricas.map(({ clase, precision, recall, f1 }) => ({ clase, precision, recall, f1 })),
        ...(adopcion && { adopcion: adopcion.get(modelo.id) ?? { porcentaje: 0, productores: 0 } }),
    };
}
