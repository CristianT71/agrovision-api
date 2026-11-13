import { Inject, Injectable, HttpException, NotFoundException } from "@nestjs/common";
import { VUELOS_REPOSITORY, type IVuelosRepository } from "../../domain/ports/out/vuelos.repository";
import { ALMACENAMIENTO_VUELOS, type IAlmacenamientoVuelos } from "../../domain/ports/out/almacenamiento-vuelos.port";
import { FIRMADOR_MEDIOS_VUELOS, type IFirmadorMedios } from "../../domain/ports/out/firmador-medios.port";
import type { ILeerMedioVuelo } from "../../domain/ports/in/medios.port";

export function rangoMedio(range: string | undefined, tamano: number) {
    if (!range) return { inicio: 0, fin: tamano - 1, parcial: false };
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const invalido = () => {
        throw new HttpException("El rango solicitado no es válido.", 416);
    };
    if (!match || (!match[1] && !match[2]) || tamano === 0) return invalido();
    if ([match[1], match[2]].some((v) => v !== "" && !Number.isSafeInteger(Number(v)))) return invalido();
    const inicio = match[1] ? Number(match[1]) : Math.max(0, tamano - Number(match[2]));
    const fin = match[1] && match[2] ? Math.min(Number(match[2]), tamano - 1) : tamano - 1;
    if (
        !Number.isSafeInteger(inicio) ||
        !Number.isSafeInteger(fin) ||
        inicio < 0 ||
        inicio >= tamano ||
        fin < inicio ||
        (!match[1] && Number(match[2]) === 0)
    )
        return invalido();
    return { inicio, fin, parcial: true };
}

@Injectable()
export class LeerMedioVueloService implements ILeerMedioVuelo {
    constructor(
        @Inject(VUELOS_REPOSITORY) private readonly repo: IVuelosRepository,
        @Inject(ALMACENAMIENTO_VUELOS) private readonly disco: IAlmacenamientoVuelos,
        @Inject(FIRMADOR_MEDIOS_VUELOS) private readonly firmador: IFirmadorMedios,
    ) {}
    async ejecutar(token: string, range?: string) {
        const carga = this.firmador.verificar(token);
        const archivo = await this.repo.archivo(carga.archivoId);
        if (!archivo || (carga.variante === "miniatura" && !archivo.metadatos.miniatura))
            throw new NotFoundException("El medio no existe.");
        const mini = carga.variante === "miniatura",
            ruta = archivo.rutaAlmacenamiento + (mini ? ".miniatura.jpg" : "");
        let tamano: number;
        try {
            tamano = await this.disco.tamano(ruta);
        } catch {
            throw new NotFoundException("El medio no está disponible.");
        }
        const rango = rangoMedio(range, tamano);
        const mime = mini ? "image/jpeg" : archivo.mime;
        return {
            flujo: this.disco.abrir(ruta, rango.parcial ? rango : undefined),
            tamano,
            ...rango,
            mime,
            nombre: mini ? "miniatura.jpg" : archivo.nombreOriginal,
            inline: ["image/jpeg", "video/mp4", "video/quicktime"].includes(mime),
        };
    }
}
