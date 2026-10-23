import type { Repository } from "typeorm";
import { TypeOrmAgronomoRepository } from "./typeorm-agronomo.repository";
import { TypeOrmAgronomoEntity } from "./typeorm-agronomo.entity";
import { TypeOrmDocumentoAgronomoEntity } from "./typeorm-documento-agronomo.entity";
import { Agronomo, type EstadoAgronomo } from "../../../../domain/entities/agronomo.entity";
import { TypeOrmUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-usuario.entity";
import { TypeOrmSesionUsuarioEntity } from "../../../../../autenticacion/infrastructure/adapters/out/persistence/typeorm-sesion-usuario.entity";

// @nestjs/typeorm se publica como ESM y Jest no lo carga: solo se usa su decorador
jest.mock("@nestjs/typeorm", () => ({ InjectRepository: () => () => undefined }));

type Actualizacion = [entidad: unknown, criterio: Record<string, unknown>, cambios: Record<string, unknown>];

function crearRepositorio() {
    const actualizaciones: Actualizacion[] = [];
    const manager = {
        save: (_entidad: unknown, datos: unknown) => Promise.resolve(datos),
        update: (entidad: unknown, criterio: Record<string, unknown>, cambios: Record<string, unknown>) => {
            actualizaciones.push([entidad, criterio, cambios]);
            return Promise.resolve();
        },
    };
    const repositorioTypeOrm = {
        create: (datos: unknown) => datos,
        manager: { transaction: (trabajo: (m: typeof manager) => Promise<unknown>) => trabajo(manager) },
    } as unknown as Repository<TypeOrmAgronomoEntity>;

    return {
        actualizaciones,
        repositorio: new TypeOrmAgronomoRepository(
            repositorioTypeOrm,
            {} as Repository<TypeOrmDocumentoAgronomoEntity>,
        ),
    };
}

const agronomoEn = (estado: EstadoAgronomo) =>
    new Agronomo(
        "a-1",
        "u-1",
        "Ana",
        "TP-1234",
        "+573001234567",
        "ana@correo.com",
        "Fitopatología",
        estado,
        new Date(),
    );

describe("TypeOrmAgronomoRepository.guardar", () => {
    it("al desactivar replica el estado y revoca las sesiones abiertas de la cuenta", async () => {
        const { repositorio, actualizaciones } = crearRepositorio();

        await repositorio.guardar(agronomoEn("inactivo"));

        expect(actualizaciones).toHaveLength(2);
        expect(actualizaciones[0][0]).toBe(TypeOrmUsuarioEntity);
        expect(actualizaciones[0][2]).toEqual({ estado: "inactivo" });
        expect(actualizaciones[1][0]).toBe(TypeOrmSesionUsuarioEntity);
        expect(actualizaciones[1][1]).toMatchObject({ usuarioId: "u-1" });
        expect(actualizaciones[1][2].revocadaEn).toBeInstanceOf(Date);
    });

    it.each(["activo", "pendiente"] as const)("con el estado %s no toca las sesiones", async (estado) => {
        const { repositorio, actualizaciones } = crearRepositorio();

        await repositorio.guardar(agronomoEn(estado));

        expect(actualizaciones).toHaveLength(1);
        expect(actualizaciones[0][0]).toBe(TypeOrmUsuarioEntity);
    });
});
