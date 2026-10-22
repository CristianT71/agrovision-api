import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository, SelectQueryBuilder } from "typeorm";
import type {
    FiltrosLecturaSolicitudes,
    ILecturaSolicitudes,
    PaginaLectura,
    SolicitudConProductor,
} from "../../../../domain/ports/out/lectura-solicitudes.port";
import { TypeOrmSolicitudEntity } from "./typeorm-solicitud.entity";
import { TypeOrmAnexoResolucionEntity } from "./typeorm-anexo-resolucion.entity";
import { AnexoResolucion } from "../../../../domain/entities/anexo-resolucion.entity";
import type { ConteoBandeja } from "../../../../domain/services/contadores-bandeja";
import { TIPO_PLAGA_NUEVA } from "../../../../domain/services/resoluciones";
import type { VentanaTiempo } from "../../../../../../common/utils/ventana-tiempo";
import { solicitudADominio } from "./solicitud.mapper";
import { escaparLike } from "../../../../../../common/utils/escapar-like";

interface FilaConteoBandeja {
    estado: string;
    casos: number;
    sin_asignar: number;
}

// fecha y fecha_resolucion son "timestamp" SIN zona. pg escribe cada Date en la hora local del proceso
// (parseInputDatesAsUTC = false) y la lee igual, así que comparar contra un Date de parámetro es correcto
// en cualquier servidor. Lo que NO es seguro es convertir de zona en SQL: no se sabe en cuál corrió quien
// escribió (en desarrollo, America/Bogota; en un servidor, normalmente UTC). Por eso aquí no se agrupa
// por día: el corte en hora de Colombia lo hace el dominio sobre los instantes ya leídos.
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

    // Lo más reciente primero; el id desempata las del mismo instante para que las páginas no se crucen
    private ordenBandeja(consulta: SelectQueryBuilder<TypeOrmSolicitudEntity>): void {
        consulta.orderBy("s.fecha", "DESC").addOrderBy("s.id", "DESC");
    }

    private aplicarFiltros(consulta: SelectQueryBuilder<TypeOrmSolicitudEntity>, filtros: FiltrosLecturaSolicitudes) {
        if (filtros.estado) consulta.andWhere("s.estado = :estado", { estado: filtros.estado });
        if (filtros.agronomoId) consulta.andWhere("s.agronomoId = :agronomoId", { agronomoId: filtros.agronomoId });
        if (filtros.sinAsignar) {
            consulta.andWhere("s.agronomoId IS NULL").andWhere("s.estado = :enviada", { enviada: "Enviada" });
        }

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
    }

    async listar(filtros: FiltrosLecturaSolicitudes): Promise<SolicitudConProductor[]> {
        const consulta = this.consultaBase();
        this.ordenBandeja(consulta);
        this.aplicarFiltros(consulta, filtros);

        const entities = await consulta.getMany();
        return entities.map((entity) => this.aResultado(entity));
    }

    async listarPagina(
        filtros: FiltrosLecturaSolicitudes,
        pagina: PaginaLectura,
    ): Promise<{ total: number; resultados: SolicitudConProductor[] }> {
        const consulta = this.consultaBase();
        this.ordenBandeja(consulta);
        this.aplicarFiltros(consulta, filtros);

        // OFFSET/LIMIT directos: el JOIN es muchos-a-uno y no multiplica filas
        consulta.offset((pagina.numero - 1) * pagina.limite).limit(pagina.limite);

        const [entities, total] = await consulta.getManyAndCount();
        return { total, resultados: entities.map((entity) => this.aResultado(entity)) };
    }

    async contarBandeja(filtros: { agronomoId?: string }): Promise<ConteoBandeja> {
        // Una sola consulta: un GROUP BY por estado y, en la misma pasada, las "Enviada" sin agrónomo
        const consulta = this.repository
            .createQueryBuilder("s")
            .select("s.estado", "estado")
            .addSelect("COUNT(*)::int", "casos")
            .addSelect("COUNT(*) FILTER (WHERE s.agronomo_id IS NULL AND s.estado = 'Enviada')::int", "sin_asignar")
            .groupBy("s.estado");

        if (filtros.agronomoId) consulta.where("s.agronomo_id = :agronomoId", { agronomoId: filtros.agronomoId });

        const filas = await consulta.getRawMany<FilaConteoBandeja>();

        return {
            porEstado: filas.map((fila) => ({ estado: fila.estado, casos: Number(fila.casos) })),
            sinAsignar: filas.reduce((suma, fila) => suma + Number(fila.sin_asignar), 0),
        };
    }

    async obtener(id: string): Promise<SolicitudConProductor | null> {
        const entity = await this.consultaBase().where("s.id = :id", { id }).getOne();
        return entity ? this.aResultado(entity) : null;
    }

    async listarResueltas(excluirId: string, limite: number): Promise<SolicitudConProductor[]> {
        const entities = await this.consultaBase()
            .where("s.estado = :estado", { estado: "Resuelta" })
            .andWhere("s.id <> :excluirId", { excluirId })
            .orderBy("s.fechaResolucion", "DESC")
            .take(limite)
            .getMany();

        return entities.map((entity) => this.aResultado(entity));
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

    // Solicitudes resueltas en la ventana [desde, hasta), según su fecha de resolución
    private resueltasEn<T extends SelectQueryBuilder<TypeOrmSolicitudEntity>>(consulta: T, ventana: VentanaTiempo): T {
        consulta
            .where("s.estado = :resuelta", { resuelta: "Resuelta" })
            .andWhere("s.fecha_resolucion >= :desde AND s.fecha_resolucion < :hasta", ventana);
        return consulta;
    }

    async contarResueltasPorTipo(ventana: VentanaTiempo): Promise<{ tipo: string | null; casos: number }[]> {
        const filas = await this.resueltasEn(
            this.repository
                .createQueryBuilder("s")
                .select("s.tipo_resultado", "tipo")
                .addSelect("COUNT(*)::int", "casos")
                .groupBy("s.tipo_resultado"),
            ventana,
        ).getRawMany<{ tipo: string | null; casos: number }>();

        return filas.map((fila) => ({ tipo: fila.tipo, casos: Number(fila.casos) }));
    }

    async fechasPlagaNueva(ventana: VentanaTiempo): Promise<Date[]> {
        // Solo una columna: aunque la ventana sea de 90 días, las plagas nuevas son pocas
        const filas = await this.resueltasEn(
            this.repository.createQueryBuilder("s").select("s.fecha_resolucion", "fecha_resolucion"),
            ventana,
        )
            .andWhere("s.tipo_resultado = :plagaNueva", { plagaNueva: TIPO_PLAGA_NUEVA })
            .getRawMany<{ fecha_resolucion: Date }>();

        return filas.map((fila) => fila.fecha_resolucion);
    }

    async listarPlagaNueva(ventana: VentanaTiempo, limite: number): Promise<SolicitudConProductor[]> {
        const entities = await this.resueltasEn(this.consultaBase(), ventana)
            .andWhere("s.tipo_resultado = :plagaNueva", { plagaNueva: TIPO_PLAGA_NUEVA })
            .orderBy("s.fechaResolucion", "DESC")
            .addOrderBy("s.id", "DESC")
            .limit(limite)
            .getMany();

        return entities.map((entity) => this.aResultado(entity));
    }

    async contarPlagaNuevaDesde(desde: Date): Promise<number> {
        return await this.repository
            .createQueryBuilder("s")
            .where("s.estado = :resuelta", { resuelta: "Resuelta" })
            .andWhere("s.tipo_resultado = :plagaNueva", { plagaNueva: TIPO_PLAGA_NUEVA })
            .andWhere("s.fecha_resolucion >= :desde", { desde })
            .getCount();
    }
}
