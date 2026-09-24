import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, Repository } from "typeorm";
import { IAgronomoRepository, FiltrosAgronomo } from "../../../../domain/ports/out/agronomo.repository";
import { Agronomo, EstadoAgronomo } from "../../../../domain/entities/agronomo.entity";
import { DocumentoAcreditacion } from "../../../../domain/entities/documento-acreditacion.entity";
import type { Usuario } from "../../../../../autenticacion/domain/entities/usuario.entity";
import { TypeOrmUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";
import { TypeOrmAgronomoEntity } from "./typeorm-agronomo.entity";
import { TypeOrmDocumentoAgronomoEntity } from "./typeorm-documento-agronomo.entity";

@Injectable()
export class TypeOrmAgronomoRepository implements IAgronomoRepository {
    constructor(
        @InjectRepository(TypeOrmAgronomoEntity)
        private readonly repository: Repository<TypeOrmAgronomoEntity>,
        @InjectRepository(TypeOrmDocumentoAgronomoEntity)
        private readonly documentoRepository: Repository<TypeOrmDocumentoAgronomoEntity>,
    ) {}

    // Mapper: Convierte el Esquema de TypeORM a Entidad pura de Dominio
    private toDomain(entity: TypeOrmAgronomoEntity): Agronomo {
        return new Agronomo(
            entity.id,
            entity.usuarioId,
            entity.nombre,
            entity.tarjetaProfesional,
            entity.telefono,
            entity.correo,
            entity.especialidad,
            entity.estado as EstadoAgronomo,
            entity.fechaAlta,
        );
    }

    private documentoToDomain(entity: TypeOrmDocumentoAgronomoEntity): DocumentoAcreditacion {
        return new DocumentoAcreditacion(
            entity.id,
            entity.agronomoId,
            entity.ruta,
            entity.nombreOriginal,
            entity.tipoMime,
            entity.tamanoBytes,
            entity.fechaSubida,
        );
    }

    // Mapper inverso: Convierte Entidad de Dominio a esquema persistible de TypeORM
    private toPersistence(agronomo: Agronomo): TypeOrmAgronomoEntity {
        return this.repository.create({
            id: agronomo.id,
            usuarioId: agronomo.usuarioId,
            nombre: agronomo.nombre,
            tarjetaProfesional: agronomo.tarjetaProfesional,
            telefono: agronomo.telefono,
            correo: agronomo.correo,
            especialidad: agronomo.especialidad,
            estado: agronomo.estado,
            fechaAlta: agronomo.fechaAlta,
        });
    }

    async findById(id: string): Promise<Agronomo | null> {
        const entity = await this.repository.findOne({ where: { id } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findByUsuarioId(usuarioId: string): Promise<Agronomo | null> {
        const entity = await this.repository.findOne({ where: { usuarioId } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findByTarjetaProfesional(tarjeta: string): Promise<Agronomo | null> {
        const entity = await this.repository.findOne({ where: { tarjetaProfesional: tarjeta } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findByCorreo(correo: string): Promise<Agronomo | null> {
        const entity = await this.repository.findOne({ where: { correo } });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findAll(filtros?: FiltrosAgronomo): Promise<Agronomo[]> {
        const where: FindOptionsWhere<TypeOrmAgronomoEntity> = {};
        if (filtros?.estado) where.estado = filtros.estado;
        if (filtros?.especialidad) where.especialidad = filtros.especialidad;

        const entities = await this.repository.find({
            where,
            order: { fechaAlta: "DESC" },
        });

        return entities.map((entity) => this.toDomain(entity));
    }

    async existeCuentaConTelefono(telefono: string): Promise<boolean> {
        return await this.repository.manager.existsBy(TypeOrmUsuarioEntity, { telefono });
    }

    async registrar(agronomo: Agronomo, usuario: Usuario, documentos: DocumentoAcreditacion[]): Promise<void> {
        // Todo o nada: no puede quedar una cuenta de login sin su agrónomo ni al revés
        await this.repository.manager.transaction(async (manager) => {
            await manager.insert(TypeOrmUsuarioEntity, {
                id: usuario.id,
                telefono: usuario.telefono,
                rol: usuario.rol,
                estado: usuario.estado,
                fechaRegistro: usuario.fechaRegistro,
            });
            await manager.insert(TypeOrmAgronomoEntity, this.toPersistence(agronomo));

            if (documentos.length > 0) {
                await manager.insert(
                    TypeOrmDocumentoAgronomoEntity,
                    documentos.map((documento) => ({
                        id: documento.id,
                        agronomoId: documento.agronomoId,
                        ruta: documento.ruta,
                        nombreOriginal: documento.nombreOriginal,
                        tipoMime: documento.tipoMime,
                        tamanoBytes: documento.tamanoBytes,
                        fechaSubida: documento.fechaSubida,
                    })),
                );
            }
        });
    }

    async guardar(agronomo: Agronomo): Promise<Agronomo> {
        // El estado del agrónomo y el de su cuenta de login se mantienen iguales
        // (pendiente / activo / inactivo) para que el login lo respete (RF-10.5)
        const saved = await this.repository.manager.transaction(async (manager) => {
            const entity = await manager.save(TypeOrmAgronomoEntity, this.toPersistence(agronomo));
            await manager.update(TypeOrmUsuarioEntity, { id: agronomo.usuarioId }, { estado: agronomo.estado });

            return entity;
        });

        return this.toDomain(saved);
    }

    async findDocumentos(agronomoId: string): Promise<DocumentoAcreditacion[]> {
        const entities = await this.documentoRepository.find({
            where: { agronomoId },
            order: { fechaSubida: "ASC" },
        });

        return entities.map((entity) => this.documentoToDomain(entity));
    }

    async findDocumento(agronomoId: string, documentoId: string): Promise<DocumentoAcreditacion | null> {
        const entity = await this.documentoRepository.findOne({ where: { id: documentoId, agronomoId } });
        if (!entity) return null;

        return this.documentoToDomain(entity);
    }

    async contarCasosActivos(agronomoIds: string[]): Promise<Map<string, number>> {
        const conteos = new Map<string, number>(agronomoIds.map((id) => [id, 0]));
        if (agronomoIds.length === 0) return conteos;

        // Se consulta la tabla por nombre para no acoplar este módulo al de solicitudes
        const filas = await this.repository.manager
            .createQueryBuilder()
            .select("s.agronomo_id", "agronomoId")
            .addSelect("COUNT(*)", "total")
            .from("solicitudes", "s")
            .where("s.estado = :estado", { estado: "Asignada" })
            .andWhere("s.agronomo_id IN (:...ids)", { ids: agronomoIds })
            .groupBy("s.agronomo_id")
            .getRawMany<{ agronomoId: string; total: string }>();

        for (const fila of filas) {
            conteos.set(fila.agronomoId, Number(fila.total));
        }

        return conteos;
    }
}
