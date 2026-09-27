import {
    Solicitud,
    type Cultivo,
    type EstadoSolicitud,
    type Organo,
    type TipoResultado,
} from "../../../../domain/entities/solicitud.entity";
import { FotoSolicitud, type AnguloFoto } from "../../../../domain/entities/foto-solicitud.entity";
import type { TypeOrmSolicitudEntity } from "./typeorm-solicitud.entity";
import type { TypeOrmFotoSolicitudEntity } from "./typeorm-foto-solicitud.entity";

// Mappers compartidos por los repositorios del panel y de la app móvil

export function solicitudADominio(entity: TypeOrmSolicitudEntity): Solicitud {
    return new Solicitud(
        entity.id,
        entity.productorId,
        entity.agronomoId,
        entity.estado as EstadoSolicitud,
        entity.fecha,
        entity.municipio,
        entity.vereda,
        entity.finca,
        entity.confianzaIa,
        entity.modeloVersionId,
        entity.respuestaProfesional,
        entity.tipoResultado as TipoResultado | null,
        entity.plagaIdentificada,
        entity.fechaResolucion,
        entity.idCliente,
        entity.capturaId,
        entity.cultivo as Cultivo | null,
        entity.organo as Organo | null,
        entity.nota,
        entity.latitud,
        entity.longitud,
        entity.precisionMetros,
        entity.actualizadoEn,
    );
}

// actualizado_en no se incluye: lo fija la base de datos en cada escritura
export function solicitudAPersistencia(solicitud: Solicitud): Omit<TypeOrmSolicitudEntity, "actualizadoEn"> {
    return {
        id: solicitud.id,
        productorId: solicitud.productorId,
        agronomoId: solicitud.agronomoId,
        estado: solicitud.estado,
        fecha: solicitud.fecha,
        municipio: solicitud.municipio,
        vereda: solicitud.vereda,
        finca: solicitud.finca,
        confianzaIa: solicitud.confianzaIa,
        modeloVersionId: solicitud.modeloVersionId,
        respuestaProfesional: solicitud.respuestaProfesional,
        tipoResultado: solicitud.tipoResultado,
        plagaIdentificada: solicitud.plagaIdentificada,
        fechaResolucion: solicitud.fechaResolucion,
        idCliente: solicitud.idCliente,
        capturaId: solicitud.capturaId,
        cultivo: solicitud.cultivo,
        organo: solicitud.organo,
        nota: solicitud.nota,
        latitud: solicitud.latitud,
        longitud: solicitud.longitud,
        precisionMetros: solicitud.precisionMetros,
    };
}

export function fotoADominio(entity: TypeOrmFotoSolicitudEntity): FotoSolicitud {
    return new FotoSolicitud(
        entity.id,
        entity.solicitudId,
        entity.idCliente,
        entity.angulo as AnguloFoto,
        entity.orden,
        entity.ruta,
        entity.tipoMime,
        entity.tamanoBytes,
        entity.subidaEn,
    );
}

export function fotoAPersistencia(foto: FotoSolicitud): TypeOrmFotoSolicitudEntity {
    return {
        id: foto.id,
        solicitudId: foto.solicitudId,
        idCliente: foto.idCliente,
        angulo: foto.angulo,
        orden: foto.orden,
        ruta: foto.ruta,
        tipoMime: foto.tipoMime,
        tamanoBytes: foto.tamanoBytes,
        subidaEn: foto.subidaEn,
    };
}
