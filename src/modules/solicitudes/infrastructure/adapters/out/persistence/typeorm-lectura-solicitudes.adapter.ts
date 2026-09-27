import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository, SelectQueryBuilder } from "typeorm";
import type {
    FiltrosLecturaSolicitudes,
    ILecturaSolicitudes,
    SolicitudConProductor,
} from "../../../../domain/ports/out/lectura-solicitudes.port";
import { TypeOrmSolicitudEntity } from "./typeorm-solicitud.entity";
import { TypeOrmAnexoResolucionEntity } from "./typeorm-anexo-resolucion.entity";
import { AnexoResolucion } from "../../../../domain/entities/anexo-resolucion.entity";
import { solicitudADominio } from "./solicitud.mapper";
import { escaparLike } from "../../../../../../common/utils/escapar-like";

@Injectable()
export class TypeOrmLecturaSolicitudesAdapter implements ILecturaSolicitudes {
    constructor(
        @InjectRepository(TypeOrmSolicitudEntity)
        private readonly repository: Repository<TypeOrmSolicitudEntity>,
        @InjectRepository(TypeOrmAnexoResolucionEntity)
        private readonly anexoRepository: Repository<TypeOrmAnexoResolucionEntity>,
    ) {}

    // Una sola consulta con JOIN al productor: evita pedir el nombre de cada productor por separado
    private consultaBase(): SelectQueryBuilder<TypeOrmSolicitudEntity> {
        return this.repository.createQueryBuilder("s").leftJoinAndSelect("s.productor", "p");
    }

    private aResultado(entity: TypeOrmSolicitudEntity): SolicitudConProductor {
        return { solicitud: solicitudADominio(entity), productorNombre: entity.productor?.nombre ?? null };
    }

    async listar(filtros: FiltrosLecturaSolicitudes): Promise<SolicitudConProductor[]> {
        const consulta = this.consultaBase().orderBy("s.fecha", "DESC");

        if (filtros.estado) consulta.andWhere("s.estado = :estado", { estado: filtros.estado });
        if (filtros.agronomoId) consulta.andWhere("s.agronomoId = :agronomoId", { agronomoId: filtros.agronomoId });

        // RF-03.5: se busca en la base (productores.nombre está indexado), no en el navegador.
        // El código "SOL-3F2A9C1B" que muestra el panel es el inicio del id de la solicitud.
        const texto = filtros.busqueda?.trim();
        if (texto) {
            const codigo = texto.replace(/^sol-/i, "");
            consulta.andWhere(
                new Brackets((o) => {
                    o.where("p.nombre ILIKE :texto")
                        .orWhere("s.finca ILIKE :texto")
                        .orWhere("s.vereda ILIKE :texto")
                        .orWhere("s.municipio ILIKE :texto")
                        .orWhere("CAST(s.id AS text) ILIKE :codigo");
                }),
                { texto: `%${escaparLike(texto)}%`, codigo: `${escaparLike(codigo.toLowerCase())}%` },
            );
        }

        const entities = await consulta.getMany();
        return entities.map((entity) => this.aResultado(entity));
    }

    async obtener(id: string): Promise<SolicitudConProductor | null> {
        const entity = await this.consultaBase().where("s.id = :id", { id }).getOne();
        return entity ? this.aResultado(entity) : null;
    }

    private anexoADominio(entity: TypeOrmAnexoResolucionEntity): AnexoResolucion {
        return new AnexoResolucion(
            entity.id,
            entity.solicitudId,
            entity.ruta,
            entity.nombreOriginal,
            entity.tipoMime,
            entity.tamanoBytes,
            entity.fechaSubida,
        );
    }

    async listarAnexos(solicitudId: string): Promise<AnexoResolucion[]> {
        const entities = await this.anexoRepository.find({ where: { solicitudId }, order: { fechaSubida: "ASC" } });
        return entities.map((entity) => this.anexoADominio(entity));
    }

    async obtenerAnexo(solicitudId: string, anexoId: string): Promise<AnexoResolucion | null> {
        const entity = await this.anexoRepository.findOne({ where: { id: anexoId, solicitudId } });
        return entity ? this.anexoADominio(entity) : null;
    }
}
