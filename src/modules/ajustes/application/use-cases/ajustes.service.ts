import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
    AJUSTES_PERSONALES_POR_DEFECTO,
    AJUSTES_SISTEMA_POR_DEFECTO,
    CLAVES_PERSONALES_POR_ROL,
    type AjustesPersonales,
    type AjustesSistema,
} from "../../domain/ajustes";
import { AJUSTES_REPOSITORY, type IAjustesRepository } from "../../domain/ports/out/ajustes.repository";

// Quita las claves sin valor (un PATCH solo trae lo que cambió)
function soloDefinidos<T extends object>(parcial: T): Partial<T> {
    return Object.fromEntries(Object.entries(parcial).filter(([, valor]) => valor !== undefined)) as Partial<T>;
}

@Injectable()
export class AjustesService {
    constructor(@Inject(AJUSTES_REPOSITORY) private readonly repositorio: IAjustesRepository) {}

    async obtenerPersonales(usuarioId: string, rol: string): Promise<Partial<AjustesPersonales>> {
        const guardados = await this.repositorio.obtenerPersonales(usuarioId);
        const completos = { ...AJUSTES_PERSONALES_POR_DEFECTO, ...guardados };
        const claves = this.clavesDe(rol);
        return Object.fromEntries(claves.map((clave) => [clave, completos[clave]]));
    }

    async guardarPersonales(
        usuarioId: string,
        rol: string,
        cambios: Partial<AjustesPersonales>,
    ): Promise<Partial<AjustesPersonales>> {
        const nuevos = soloDefinidos(cambios);
        const permitidas = this.clavesDe(rol);
        const ajenas = Object.keys(nuevos).filter((clave) => !permitidas.includes(clave as keyof AjustesPersonales));
        if (ajenas.length > 0) {
            throw new BadRequestException(`Estos ajustes no existen para tu rol: ${ajenas.join(", ")}.`);
        }
        const guardados = await this.repositorio.obtenerPersonales(usuarioId);
        await this.repositorio.guardarPersonales(usuarioId, { ...guardados, ...nuevos });
        return await this.obtenerPersonales(usuarioId, rol);
    }

    async obtenerSistema(): Promise<AjustesSistema> {
        return { ...AJUSTES_SISTEMA_POR_DEFECTO, ...(await this.repositorio.obtenerSistema()) };
    }

    async guardarSistema(cambios: Partial<AjustesSistema>, usuarioId: string): Promise<AjustesSistema> {
        const guardados = await this.repositorio.obtenerSistema();
        await this.repositorio.guardarSistema({ ...guardados, ...soloDefinidos(cambios) }, usuarioId);
        return await this.obtenerSistema();
    }

    private clavesDe(rol: string): (keyof AjustesPersonales)[] {
        return CLAVES_PERSONALES_POR_ROL[rol] ?? [];
    }
}
