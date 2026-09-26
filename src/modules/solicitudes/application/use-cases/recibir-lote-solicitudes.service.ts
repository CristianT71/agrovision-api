import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import {
    MAX_SOLICITUDES_POR_LOTE,
    type IRecibirLoteSolicitudesUseCase,
    type RecibirLoteCommand,
    type ResultadoSolicitudApp,
    type SolicitudAppEntrada,
} from "../../domain/ports/in/solicitudes-app.port";
import {
    SOLICITUD_APP_REPOSITORY,
    type ISolicitudAppRepository,
} from "../../domain/ports/out/solicitud-app.repository";
import { FIRMADOR_URLS_SUBIDA, type IFirmadorUrlsSubida } from "../../domain/ports/out/firmador-urls-subida.port";
import {
    PRODUCTOR_REPOSITORY,
    type IProductorRepository,
} from "../../../productores/domain/ports/out/productor.repository";
import type { Productor } from "../../../productores/domain/entities/productor.entity";
import { Solicitud, SolicitudAppInvalidaError } from "../../domain/entities/solicitud.entity";
import type { FotoSolicitud } from "../../domain/entities/foto-solicitud.entity";

@Injectable()
export class RecibirLoteSolicitudesService implements IRecibirLoteSolicitudesUseCase {
    constructor(
        @Inject(SOLICITUD_APP_REPOSITORY)
        private readonly solicitudAppRepository: ISolicitudAppRepository,
        @Inject(PRODUCTOR_REPOSITORY)
        private readonly productorRepository: IProductorRepository,
        @Inject(FIRMADOR_URLS_SUBIDA)
        private readonly firmador: IFirmadorUrlsSubida,
    ) {}

    async ejecutar(comando: RecibirLoteCommand): Promise<{ results: ResultadoSolicitudApp[] }> {
        if (comando.solicitudes.length > MAX_SOLICITUDES_POR_LOTE) {
            throw new BadRequestException(`Un lote admite como máximo ${MAX_SOLICITUDES_POR_LOTE} solicitudes.`);
        }

        // 1. Sin perfil de productor no hay finca que asociar a la solicitud
        const productor = await this.productorRepository.findByUsuarioId(comando.usuarioId);
        if (!productor) {
            return {
                results: comando.solicitudes.map((entrada) => this.rechazada(entrada.idCliente, "perfil_incompleto")),
            };
        }

        // 2. En orden: si el lote repite un id, la segunda aparición sale como duplicada
        const results: ResultadoSolicitudApp[] = [];
        for (const entrada of comando.solicitudes) {
            results.push(await this.recibir(entrada, productor));
        }

        return { results };
    }

    private async recibir(entrada: SolicitudAppEntrada, productor: Productor): Promise<ResultadoSolicitudApp> {
        // La app reintenta cuando pierde la respuesta: una solicitud conocida no se crea otra vez
        const existente = await this.solicitudAppRepository.findByIdCliente(entrada.idCliente);
        if (existente) return await this.comoDuplicada(existente, entrada.idCliente, productor.id);

        let creada: { solicitud: Solicitud; fotos: FotoSolicitud[] };
        try {
            creada = Solicitud.crearDesdeApp({
                id: uuidv4(),
                idCliente: entrada.idCliente,
                productor,
                capturaId: entrada.capturaId,
                cultivo: entrada.cultivo,
                organo: entrada.organo,
                nota: entrada.nota,
                fecha: new Date(entrada.creadaEn),
                ubicacion: entrada.ubicacion,
                fotos: entrada.fotos.map((foto) => ({ id: uuidv4(), idCliente: foto.idCliente, angulo: foto.angulo })),
            });
        } catch (error) {
            // Un rechazo solo afecta a esta solicitud, no al resto del lote
            if (error instanceof SolicitudAppInvalidaError) return this.rechazada(entrada.idCliente, error.codigo);
            throw error;
        }

        const guardada = await this.solicitudAppRepository.crearConFotos(creada.solicitud, creada.fotos);
        if (!guardada) {
            // Otra petición con el mismo id pudo crearla entre la consulta y el INSERT
            const ganadora = await this.solicitudAppRepository.findByIdCliente(entrada.idCliente);
            return ganadora
                ? await this.comoDuplicada(ganadora, entrada.idCliente, productor.id)
                : this.rechazada(entrada.idCliente, "imagenes_repetidas");
        }

        return {
            id: entrada.idCliente,
            serverId: creada.solicitud.id,
            status: "accepted",
            uploadUrl: null,
            reason: null,
            imageUploads: this.urlsDeSubida(creada.fotos),
        };
    }

    private async comoDuplicada(
        existente: Solicitud,
        idCliente: string,
        productorId: string,
    ): Promise<ResultadoSolicitudApp> {
        // El id lo eligió el cliente: nunca se revelan datos de una solicitud de otro productor
        if (existente.productorId !== productorId) return this.rechazada(idCliente, "id_en_uso");

        // Se vuelven a firmar solo las fotos que faltan: la app pudo perder las URLs anteriores
        const fotos = await this.solicitudAppRepository.listarFotos(existente.id);

        return {
            id: idCliente,
            serverId: existente.id,
            status: "duplicate",
            uploadUrl: null,
            reason: null,
            imageUploads: this.urlsDeSubida(fotos.filter((foto) => !foto.estaSubida())),
        };
    }

    private urlsDeSubida(fotos: FotoSolicitud[]): { imageId: string; uploadUrl: string }[] {
        return [...fotos]
            .sort((a, b) => a.orden - b.orden)
            .map((foto) => ({ imageId: foto.idCliente, uploadUrl: this.firmador.firmar(foto.id) }));
    }

    private rechazada(idCliente: string, motivo: string): ResultadoSolicitudApp {
        return {
            id: idCliente,
            serverId: null,
            status: "rejected",
            uploadUrl: null,
            reason: motivo,
            imageUploads: null,
        };
    }
}
