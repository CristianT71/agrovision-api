import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsRelations, FindOptionsWhere, ILike, In, Not, Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { IPlagaRepository, FiltrosPlaga } from "../../../../domain/ports/out/plaga.repository";
import { Plaga, TipoPlaga } from "../../../../domain/entities/plaga.entity";
import { AvalPlaga } from "../../../../domain/entities/aval-plaga.entity";
import { TypeOrmPlagaEntity } from "./typeorm-plaga.entity";
import { TypeOrmSinonimoPlagaEntity } from "./typeorm-sinonimo-plaga.entity";
import { escaparLike } from "../../../../../../common/utils/escapar-like";

// El agregado siempre se lee completo: sin sinónimos ni avales la ficha no se puede evaluar
const RELACIONES: FindOptionsRelations<TypeOrmPlagaEntity> = { sinonimos: true, avales: true };

@Injectable()
export class TypeOrmPlagaRepository implements IPlagaRepository {
    constructor(
        @InjectRepository(TypeOrmPlagaEntity)
        private readonly plagaRepository: Repository<TypeOrmPlagaEntity>,
    ) {}

    // Mapper: Convierte el Esquema de TypeORM a Entidad pura de Dominio
    private toDomain(entity: TypeOrmPlagaEntity): Plaga {
        const avales = (entity.avales ?? []).map(
            (aval) => new AvalPlaga(aval.id, aval.agronomoId, aval.numeroTarjeta, aval.fechaAval),
        );

        return new Plaga(
            entity.id,
            entity.nombreComun,
            entity.nombreCientifico,
            entity.tipo as TipoPlaga,
            entity.descripcion,
            entity.sintomas,
            entity.cultivo,
            entity.organosAfectados,
            entity.hospederos,
            entity.medidasContencion,
            entity.protocoloQuimico,
            entity.fotoUrl,
            (entity.sinonimos ?? []).map((sinonimo) => sinonimo.sinonimo),
            avales,
        );
    }

    async findById(id: string): Promise<Plaga | null> {
        const entity = await this.plagaRepository.findOne({ where: { id }, relations: RELACIONES });
        if (!entity) return null;

        return this.toDomain(entity);
    }

    async findAll(filtros?: FiltrosPlaga): Promise<Plaga[]> {
        const where: FindOptionsWhere<TypeOrmPlagaEntity> = {};
        if (filtros?.tipo) where.tipo = filtros.tipo;

        // Búsqueda libre (RF-05.2): se resuelve en dos pasos. Primero se obtienen los ids que
        // coinciden por nombre común, nombre científico o sinónimo; después se cargan esas
        // fichas completas. Filtrar y cargar en una sola consulta recortaría la lista de
        // sinónimos devuelta a los que coinciden con el texto.
        if (filtros?.busqueda) {
            const filas = await this.plagaRepository
                .createQueryBuilder("plaga")
                .select("plaga.id", "id")
                .distinct(true)
                .leftJoin(TypeOrmSinonimoPlagaEntity, "sinonimo", "sinonimo.plaga_id = plaga.id")
                .where(
                    "plaga.nombre_comun ILIKE :texto OR plaga.nombre_cientifico ILIKE :texto OR sinonimo.sinonimo ILIKE :texto",
                    { texto: `%${escaparLike(filtros.busqueda)}%` },
                )
                .getRawMany<{ id: string }>();

            const ids = filas.map((fila) => fila.id);
            if (ids.length === 0) return [];

            where.id = In(ids);
        }

        const entities = await this.plagaRepository.find({
            where,
            relations: RELACIONES,
            order: { nombreComun: "ASC" },
        });

        // "conAval" se resuelve sobre el agregado ya cargado: los avales vienen en la misma
        // consulta, así que no hace falta otra ida a la base. false es un filtro válido
        // (fichas todavía sin aval, RF-05.7).
        if (filtros?.conAval !== undefined) {
            return entities
                .filter((entity) => (entity.avales?.length ?? 0) > 0 === filtros.conAval)
                .map((entity) => this.toDomain(entity));
        }

        return entities.map((entity) => this.toDomain(entity));
    }

    async existeNombreCientifico(nombre: string, excluirId?: string): Promise<boolean> {
        // ILike sin comodines equivale a una comparación exacta sin distinguir mayúsculas
        const where: FindOptionsWhere<TypeOrmPlagaEntity> = { nombreCientifico: ILike(nombre) };
        if (excluirId) where.id = Not(excluirId);

        return (await this.plagaRepository.countBy(where)) > 0;
    }

    async guardar(plaga: Plaga): Promise<Plaga> {
        // Se recupera el estado persistido para reutilizar los ids de los sinónimos y avales
        // que ya existen: el dominio maneja los sinónimos como texto y no conoce sus ids
        const existente = await this.plagaRepository.findOne({
            where: { id: plaga.id },
            relations: RELACIONES,
        });

        const sinonimos = plaga.sinonimos.map((texto) => {
            const previo = existente?.sinonimos?.find(
                (sinonimo) => sinonimo.sinonimo.toLowerCase() === texto.toLowerCase(),
            );

            return {
                id: previo?.id ?? uuidv4(),
                plagaId: plaga.id,
                sinonimo: texto,
            };
        });

        const avales = plaga.avales.map((aval) => {
            const previo = existente?.avales?.find((registrado) => registrado.agronomoId === aval.agronomoId);

            return {
                id: previo?.id ?? aval.id ?? uuidv4(),
                plagaId: plaga.id,
                agronomoId: aval.agronomoId,
                numeroTarjeta: aval.numeroTarjeta,
                fechaAval: aval.fechaAval,
            };
        });

        // Mapper inverso: Convierte Entidad de Dominio a esquema persistible de TypeORM.
        // Un solo save() propaga la cascada a sinónimos y avales.
        await this.plagaRepository.save({
            id: plaga.id,
            nombreComun: plaga.nombreComun,
            nombreCientifico: plaga.nombreCientifico,
            tipo: plaga.tipo,
            descripcion: plaga.descripcion,
            sintomas: plaga.sintomas,
            cultivo: plaga.cultivo,
            organosAfectados: plaga.organosAfectados,
            hospederos: plaga.hospederos,
            medidasContencion: plaga.medidasContencion,
            protocoloQuimico: plaga.protocoloQuimico,
            fotoUrl: plaga.fotoUrl,
            sinonimos,
            avales,
        });

        const recargada = await this.findById(plaga.id);
        if (!recargada) {
            throw new Error("No se pudo recargar la ficha luego de guardarla.");
        }

        return recargada;
    }
}
