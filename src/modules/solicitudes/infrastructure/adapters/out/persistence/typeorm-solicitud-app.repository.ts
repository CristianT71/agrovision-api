import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, IsNull, MoreThan, Not, QueryFailedError, Repository } from "typeorm";
import type { ISolicitudAppRepository } from "../../../../domain/ports/out/solicitud-app.repository";
import type { Solicitud } from "../../../../domain/entities/solicitud.entity";
import type { FotoSolicitud } from "../../../../domain/entities/foto-solicitud.entity";
import { TypeOrmSolicitudEntity } from "./typeorm-solicitud.entity";
import { TypeOrmFotoSolicitudEntity } from "./typeorm-foto-solicitud.entity";
import { fotoADominio, fotoAPersistencia, solicitudADominio, solicitudAPersistencia } from "./solicitud.mapper";

// Código de PostgreSQL para una violación de restricción UNIQUE
const VIOLACION_UNICA = "23505";

@Injectable()
export class TypeOrmSolicitudAppRepository implements ISolicitudAppRepository {
    constructor(
        @InjectRepository(TypeOrmSolicitudEntity)
        private readonly solicitudRepository: Repository<TypeOrmSolicitudEntity>,
        @InjectRepository(TypeOrmFotoSolicitudEntity)
        private readonly fotoRepository: Repository<TypeOrmFotoSolicitudEntity>,
    ) {}

    async findByIdCliente(idCliente: string): Promise<Solicitud | null> {
        const entity = await this.solicitudRepository.findOne({ where: { idCliente } });
        return entity ? solicitudADominio(entity) : null;
    }

    async crearConFotos(solicitud: Solicitud, fotos: FotoSolicitud[]): Promise<boolean> {
        try {
            // Todo o nada: nunca queda una solicitud sin sus fotos ni fotos sin solicitud
            await this.solicitudRepository.manager.transaction(async (manager) => {
                await manager.insert(TypeOrmSolicitudEntity, solicitudAPersistencia(solicitud));
                await manager.insert(TypeOrmFotoSolicitudEntity, fotos.map(fotoAPersistencia));
            });
            return true;
        } catch (error) {
            if (
                error instanceof QueryFailedError &&
                (error.driverError as { code?: string }).code === VIOLACION_UNICA
            ) {
                return false;
            }
            throw error;
        }
    }

    async listarPorProductor(productorId: string, actualizadasDesde?: Date): Promise<Solicitud[]> {
        // Solo las creadas desde la app: sin id del cliente la app no sabría a cuál corresponden
        const where: FindOptionsWhere<TypeOrmSolicitudEntity> = { productorId, idCliente: Not(IsNull()) };
        if (actualizadasDesde) where.actualizadoEn = MoreThan(actualizadasDesde);

        const entities = await this.solicitudRepository.find({ where, order: { actualizadoEn: "ASC" } });

        return entities.map((entity) => solicitudADominio(entity));
    }

    async listarFotos(solicitudId: string): Promise<FotoSolicitud[]> {
        const entities = await this.fotoRepository.find({ where: { solicitudId }, order: { orden: "ASC" } });
        return entities.map((entity) => fotoADominio(entity));
    }

    async findFotoById(id: string): Promise<FotoSolicitud | null> {
        const entity = await this.fotoRepository.findOne({ where: { id } });
        return entity ? fotoADominio(entity) : null;
    }

    async marcarFotoSubida(foto: FotoSolicitud): Promise<boolean> {
        // UPDATE condicionado: dos subidas simultáneas de la misma foto no se pisan
        const resultado = await this.fotoRepository.update(
            { id: foto.id, ruta: IsNull() },
            { ruta: foto.ruta, tipoMime: foto.tipoMime, tamanoBytes: foto.tamanoBytes, subidaEn: foto.subidaEn },
        );

        return (resultado.affected ?? 0) > 0;
    }

    async guardarEnvio(solicitud: Solicitud): Promise<boolean> {
        // UPDATE condicionado: solo pasa si la fila sigue "Pendiente" (mismo patrón que guardarAsignacion)
        const resultado = await this.solicitudRepository.update(
            { id: solicitud.id, estado: "Pendiente" },
            { estado: solicitud.estado },
        );

        return (resultado.affected ?? 0) > 0;
    }
}
