import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
    ArchivoRecibido,
    ArchivoVuelo,
    ConsultaArchivos,
    ConsultaVuelos,
    Vuelo,
} from "../../domain/entities/vuelo";
import type { IGestionVuelos } from "../../domain/ports/in/vuelos.port";
import { VUELOS_REPOSITORY, type IVuelosRepository } from "../../domain/ports/out/vuelos.repository";
import { ALMACENAMIENTO_VUELOS, type IAlmacenamientoVuelos } from "../../domain/ports/out/almacenamiento-vuelos.port";
import { EXTRACTOR_METADATOS_VUELOS, type IExtractorMetadatos } from "../../domain/ports/out/extractor-metadatos.port";
import { FIRMADOR_MEDIOS_VUELOS, type IFirmadorMedios } from "../../domain/ports/out/firmador-medios.port";
import { AUDITORIA_VUELOS, type IAuditoriaVuelos } from "../../domain/ports/out/auditoria-vuelos.port";
import { ArchivoVueloNoEncontradoError, VueloNoEncontradoError } from "../../domain/errors/vuelos.error";
import { construirTraza } from "../../domain/services/traza";

export function vistaArchivo(a: ArchivoVuelo, detalle = false) {
    const ubicacion = {
        latitud: a.latitud,
        longitud: a.longitud,
        altitudAbsolutaM: a.altitudAbsolutaM,
        alturaRelativaM: a.alturaRelativaM,
        tipoAltitud: a.tipoAltitud,
    };
    return {
        id: a.id,
        vueloId: a.vueloId,
        nombreOriginal: a.nombreOriginal,
        tipo: a.tipo,
        banda: a.banda,
        mime: a.mime,
        tamanoBytes: a.tamanoBytes,
        sha256: a.sha256,
        capturadoEn: a.capturadoEn,
        ubicacion: Object.values(ubicacion).every((v) => v === null) ? null : ubicacion,
        gps: a.metadatos.gps ?? null,
        camara: a.metadatos.camara ?? null,
        orientacion: a.metadatos.orientacion ?? null,
        multiespectral: a.metadatos.multiespectral ?? null,
        dron: a.metadatos.dron ?? null,
        ...(detalle
            ? { metadatosCrudos: { ...a.metadatos.crudos, ...(a.metadatos.traza ? { traza: a.metadatos.traza } : {}) } }
            : {}),
    };
}

@Injectable()
export class GestionVuelosService implements IGestionVuelos {
    private readonly logger = new Logger(GestionVuelosService.name);
    constructor(
        @Inject(VUELOS_REPOSITORY) private readonly repo: IVuelosRepository,
        @Inject(ALMACENAMIENTO_VUELOS) private readonly disco: IAlmacenamientoVuelos,
        @Inject(EXTRACTOR_METADATOS_VUELOS) private readonly extractor: IExtractorMetadatos,
        @Inject(FIRMADOR_MEDIOS_VUELOS) private readonly firmador: IFirmadorMedios,
        @Inject(AUDITORIA_VUELOS) private readonly auditoria: IAuditoriaVuelos,
    ) {}
    async crear(actor: string, datos: Pick<Vuelo, "nombre" | "lote" | "notas">) {
        const v: Vuelo = { ...datos, id: randomUUID(), creadoEn: new Date(), creadoPor: actor };
        await this.repo.crearAuditado(v);
        return this.obtener(v.id);
    }
    async listar(consulta: ConsultaVuelos) {
        const pagina = await this.repo.listar(consulta);
        const resumenes = await this.repo.resumen(pagina.datos.map((v) => v.id));
        return {
            ...pagina,
            datos: pagina.datos.map(({ creadoPor: _actor, ...v }) => ({ ...v, resumen: resumenes[v.id] })),
        };
    }
    async obtener(id: string) {
        const v = await this.repo.obtener(id);
        if (!v) throw new VueloNoEncontradoError();
        const { creadoPor: _actor, ...vista } = v;
        return { ...vista, resumen: (await this.repo.resumen([id]))[id] };
    }
    async exigirVuelo(id: string) {
        if (!(await this.repo.obtener(id))) throw new VueloNoEncontradoError();
    }
    async actualizar(id: string, datos: Partial<Pick<Vuelo, "nombre" | "lote" | "notas">>) {
        await this.exigirVuelo(id);
        await this.repo.actualizar(id, datos);
        return this.obtener(id);
    }
    async eliminar(id: string, actor: string) {
        if (!(await this.repo.eliminarAuditado(id, actor))) throw new VueloNoEncontradoError();
        try {
            await this.disco.eliminarVuelo(id);
        } catch (error) {
            this.logDisco(error);
        }
    }
    async subir(id: string, recibido: ArchivoRecibido) {
        let confirmado = false;
        try {
            await this.exigirVuelo(id);
            const datos = await this.extractor.extraer(
                this.disco.rutaLocal(recibido.rutaAlmacenamiento),
                recibido.nombreOriginal,
            );
            datos.metadatos.miniatura = await this.disco.miniatura(recibido.rutaAlmacenamiento, recibido.mime);
            const { extension: _extension, ...base } = recibido;
            const resultado = await this.repo.guardarArchivo({ ...base, ...datos, vueloId: id, creadoEn: new Date() });
            confirmado = true;
            if (resultado.duplicado) await this.limpiar(recibido.rutaAlmacenamiento);
            return { archivo: vistaArchivo(resultado.archivo), duplicado: resultado.duplicado };
        } finally {
            if (!confirmado) await this.limpiar(recibido.rutaAlmacenamiento);
        }
    }
    async listarArchivos(id: string, consulta: ConsultaArchivos) {
        await this.exigirVuelo(id);
        const pagina = await this.repo.listarArchivos(id, consulta);
        return { ...pagina, datos: pagina.datos.map((a) => vistaArchivo(a)) };
    }
    async obtenerArchivo(id: string, archivoId: string) {
        return vistaArchivo(await this.archivoPropio(id, archivoId), true);
    }
    async enlace(id: string, archivoId: string, actor: string) {
        const archivo = await this.archivoPropio(id, archivoId),
            exp = Date.now() + 5 * 60_000;
        const urlContenido = `/api/vuelos/medios/${this.firmador.firmar(archivoId, "contenido", exp)}`;
        const urlMiniatura = archivo.metadatos.miniatura
            ? `/api/vuelos/medios/${this.firmador.firmar(archivoId, "miniatura", exp)}`
            : null;
        // Si no se puede auditar, no se entrega el enlace.
        await this.auditoria.registrar({ accion: "enlace_emitido", actorUsuarioId: actor, vueloId: id, archivoId });
        return { urlContenido, urlMiniatura, expiraEn: new Date(exp).toISOString() };
    }
    async traza(id: string) {
        await this.exigirVuelo(id);
        return construirTraza(await this.repo.puntos(id));
    }
    private async archivoPropio(id: string, archivoId: string) {
        const a = await this.repo.archivo(archivoId, id);
        if (!a) throw new ArchivoVueloNoEncontradoError();
        return a;
    }
    private async limpiar(ruta: string) {
        try {
            await this.disco.eliminarArchivo(ruta);
        } catch (error) {
            this.logDisco(error);
        }
    }
    private logDisco(error: unknown) {
        const codigo =
            error && typeof error === "object" && "code" in error
                ? String(error.code)
                      .replace(/[^A-Z0-9_]/g, "")
                      .slice(0, 30)
                : "DESCONOCIDO";
        this.logger.error(`No se pudo completar la limpieza del disco. Código: ${codigo}.`);
    }
}
