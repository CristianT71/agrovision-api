import { Inject, Injectable } from "@nestjs/common";
import type { IAsistenteVuelos } from "../../domain/ports/in/asistente-vuelos.port";
import { ASISTENTE_IA, type IAsistenteIa } from "../../domain/ports/out/asistente-ia.port";
import { VUELOS_REPOSITORY, type IVuelosRepository } from "../../domain/ports/out/vuelos.repository";
import { VueloNoEncontradoError } from "../../domain/errors/vuelos.error";

// El vuelo se comprueba antes de llamar al asistente: así no se gasta saldo del modelo en vuelos inexistentes.
@Injectable()
export class AsistenteVuelosService implements IAsistenteVuelos {
    constructor(
        @Inject(VUELOS_REPOSITORY) private readonly repo: IVuelosRepository,
        @Inject(ASISTENTE_IA) private readonly asistente: IAsistenteIa,
    ) {}

    async conversar(vueloId: string, sessionId: string, chatInput: string) {
        await this.exigirVuelo(vueloId);
        return this.asistente.conversar({ vueloId, sessionId, chatInput });
    }

    async descargarInforme(vueloId: string, codigo: string) {
        await this.exigirVuelo(vueloId);
        return this.asistente.descargarInforme(codigo);
    }

    private async exigirVuelo(id: string) {
        if (!(await this.repo.obtener(id))) throw new VueloNoEncontradoError();
    }
}
