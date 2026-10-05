import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { DeteccionExistente, IDeteccionRepository } from "../../../../domain/ports/out/deteccion.repository";
import type { Deteccion } from "../../../../domain/entities/deteccion.entity";
import { TypeOrmDeteccionEntity } from "./typeorm-deteccion.entity";

@Injectable()
export class TypeOrmDeteccionRepository implements IDeteccionRepository {
    constructor(
        @InjectRepository(TypeOrmDeteccionEntity)
        private readonly deteccionRepository: Repository<TypeOrmDeteccionEntity>,
    ) {}

    async findExistentes(idsCliente: string[]): Promise<DeteccionExistente[]> {
        // "IN ()" no es SQL válido: sin ids no hay nada que buscar
        if (idsCliente.length === 0) return [];

        return await this.deteccionRepository.find({
            select: { id: true, idCliente: true, productorId: true },
            where: { idCliente: In(idsCliente) },
        });
    }

    async insertarNuevas(detecciones: Deteccion[]): Promise<Set<string>> {
        if (detecciones.length === 0) return new Set();

        // Un solo INSERT para todo el lote. ON CONFLICT DO NOTHING: si otra petición guardó la misma
        // captura primero, esa fila se omite en lugar de tumbar el lote, y RETURNING dice cuáles entraron.
        const resultado = await this.deteccionRepository
            .createQueryBuilder()
            .insert()
            .into(TypeOrmDeteccionEntity)
            .values(detecciones.map((deteccion) => this.toPersistence(deteccion)))
            .orIgnore()
            .returning(["idCliente"])
            .execute();

        const filas = resultado.raw as { id_cliente: string }[];
        return new Set(filas.map((fila) => fila.id_cliente));
    }

    private toPersistence(deteccion: Deteccion): TypeOrmDeteccionEntity {
        return {
            id: deteccion.id,
            idCliente: deteccion.idCliente,
            productorId: deteccion.productorId,
            tipo: deteccion.categoria,
            clasePredicha: deteccion.clasePredicha,
            confianza: deteccion.confianza,
            puntajeOod: deteccion.puntajeOod,
            resultadoCompuerta: deteccion.resultadoCompuerta,
            modeloId: deteccion.modeloId,
            modeloVersion: deteccion.modeloVersion,
            correccionProductor: deteccion.correccionProductor,
            confirmadaProductor: deteccion.confirmadaProductor,
            cultivo: deteccion.cultivo,
            organo: deteccion.organo,
            latitud: deteccion.latitud,
            longitud: deteccion.longitud,
            precisionMetros: deteccion.precisionMetros,
            embedding: deteccion.embedding,
            municipio: deteccion.municipio,
            fecha: deteccion.fecha,
            recibidaEn: deteccion.recibidaEn,
            defectuosa: deteccion.defectuosa,
        };
    }
}
