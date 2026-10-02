import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import {
    MAX_CAPTURAS_POR_LOTE,
    type IRecibirCapturasUseCase,
    type RecibirCapturasCommand,
    type ResultadoCapturaApp,
} from "../../domain/ports/in/recibir-capturas.port";
import {
    DETECCION_REPOSITORY,
    type DeteccionExistente,
    type IDeteccionRepository,
} from "../../domain/ports/out/deteccion.repository";
import { CONSULTA_MODELOS, type IConsultaModelos } from "../../domain/ports/out/consulta-modelos.port";
import {
    PRODUCTOR_REPOSITORY,
    type IProductorRepository,
} from "../../../productores/domain/ports/out/productor.repository";
import type { Productor } from "../../../productores/domain/entities/productor.entity";
import { CapturaInvalidaError, Deteccion } from "../../domain/entities/deteccion.entity";

// RF-07.1: registra todas las inferencias crudas que hace el modelo en los teléfonos
@Injectable()
export class RecibirCapturasService implements IRecibirCapturasUseCase {
    constructor(
        @Inject(DETECCION_REPOSITORY)
        private readonly deteccionRepository: IDeteccionRepository,
        @Inject(CONSULTA_MODELOS)
        private readonly consultaModelos: IConsultaModelos,
        @Inject(PRODUCTOR_REPOSITORY)
        private readonly productorRepository: IProductorRepository,
    ) {}

    async ejecutar(comando: RecibirCapturasCommand): Promise<{ results: ResultadoCapturaApp[] }> {
        if (comando.capturas.length > MAX_CAPTURAS_POR_LOTE) {
            throw new BadRequestException(`Un lote admite como máximo ${MAX_CAPTURAS_POR_LOTE} capturas.`);
        }

        // 1. Sin perfil de productor no hay municipio ni dueño que asociar a la detección
        const productor = await this.productorRepository.findByUsuarioId(comando.usuarioId);
        if (!productor) {
            return { results: comando.capturas.map((c) => this.rechazada(c.idCliente, "perfil_incompleto")) };
        }

        // 2. Las ya recibidas no se crean otra vez: una sola consulta para todo el lote
        const existentes = new Map(
            (await this.deteccionRepository.findExistentes(comando.capturas.map((c) => c.idCliente))).map((d) => [
                d.idCliente,
                d,
            ]),
        );

        // 3. Cada captura se valida por separado: un rechazo no tumba el resto del lote
        const resultados = new Map<string, ResultadoCapturaApp>();
        const nuevas: Deteccion[] = [];
        const modelos = new Map<string, string | null>();

        for (const captura of comando.capturas) {
            // Si el lote repite un id, la segunda aparición sale como duplicada
            const yaVista = existentes.get(captura.idCliente) ?? nuevas.find((d) => d.idCliente === captura.idCliente);
            if (yaVista) {
                resultados.set(captura.idCliente, this.comoDuplicada(yaVista, captura.idCliente, productor.id));
                continue;
            }

            try {
                const deteccion = Deteccion.registrar({
                    ...captura,
                    id: uuidv4(),
                    productor: { id: productor.id, municipio: productor.municipio },
                    modelo: {
                        id: await this.idDeModelo(captura.modeloVersion, modelos),
                        version: captura.modeloVersion,
                    },
                    fecha: new Date(captura.capturadaEn),
                });
                nuevas.push(deteccion);
            } catch (error) {
                if (error instanceof CapturaInvalidaError) {
                    resultados.set(captura.idCliente, this.rechazada(captura.idCliente, error.codigo));
                    continue;
                }
                throw error;
            }
        }

        // 4. Todas las nuevas en una sola inserción
        const insertadas = await this.deteccionRepository.insertarNuevas(nuevas);
        await this.resolverCarreras(nuevas, insertadas, resultados, productor);

        // 5. En el mismo orden en que llegaron (toda captura tiene resultado en este punto)
        return {
            results: comando.capturas.map(
                (c) => resultados.get(c.idCliente) ?? this.rechazada(c.idCliente, "sin_resultado"),
            ),
        };
    }

    // Otra petición con el mismo id pudo guardarla entre la consulta y el INSERT
    private async resolverCarreras(
        nuevas: Deteccion[],
        insertadas: Set<string>,
        resultados: Map<string, ResultadoCapturaApp>,
        productor: Productor,
    ): Promise<void> {
        const perdidas = nuevas.filter((d) => !insertadas.has(d.idCliente));
        const ganadoras = new Map(
            (await this.deteccionRepository.findExistentes(perdidas.map((d) => d.idCliente))).map((d) => [
                d.idCliente,
                d,
            ]),
        );

        for (const deteccion of nuevas) {
            if (insertadas.has(deteccion.idCliente)) {
                resultados.set(deteccion.idCliente, {
                    id: deteccion.idCliente,
                    serverId: deteccion.id,
                    status: "accepted",
                    uploadUrl: null,
                    reason: null,
                });
                continue;
            }

            const ganadora = ganadoras.get(deteccion.idCliente);
            resultados.set(
                deteccion.idCliente,
                ganadora
                    ? this.comoDuplicada(ganadora, deteccion.idCliente, productor.id)
                    : this.rechazada(deteccion.idCliente, "id_en_uso"),
            );
        }
    }

    // La versión se busca una sola vez por lote: casi todas las capturas traen la misma
    private async idDeModelo(version: string, cache: Map<string, string | null>): Promise<string | null> {
        if (!cache.has(version)) cache.set(version, await this.consultaModelos.obtenerIdPorVersion(version));
        return cache.get(version) ?? null;
    }

    private comoDuplicada(
        existente: Pick<DeteccionExistente, "id" | "productorId">,
        idCliente: string,
        productorId: string,
    ): ResultadoCapturaApp {
        // El id lo eligió el cliente: nunca se revela una captura de otro productor
        if (existente.productorId !== productorId) return this.rechazada(idCliente, "id_en_uso");

        return { id: idCliente, serverId: existente.id, status: "duplicate", uploadUrl: null, reason: null };
    }

    private rechazada(idCliente: string, motivo: string): ResultadoCapturaApp {
        return { id: idCliente, serverId: null, status: "rejected", uploadUrl: null, reason: motivo };
    }
}
