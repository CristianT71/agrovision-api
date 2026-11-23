import type { Repository } from "typeorm";
import { TypeOrmPoliticaDatosRepository } from "./typeorm-politica-datos.repository";
import { TypeOrmUsuarioEntity } from "./typeorm-usuario.entity";
import { TypeOrmProductorEntity } from "../../../../../productores/infrastructure/adapters/out/persistence/typeorm-productor.entity";

// @nestjs/typeorm se publica como ESM y Jest no lo carga: solo se usa su decorador
jest.mock("@nestjs/typeorm", () => ({ InjectRepository: () => () => undefined }));

type Actualizacion = [entidad: unknown, criterio: Record<string, unknown>, cambios: Record<string, unknown>];

describe("TypeOrmPoliticaDatosRepository.revocar", () => {
    it("retira también el consentimiento del productor en la misma transacción", async () => {
        const actualizaciones: Actualizacion[] = [];
        const manager = {
            update: (entidad: unknown, criterio: Record<string, unknown>, cambios: Record<string, unknown>) => {
                actualizaciones.push([entidad, criterio, cambios]);
                return Promise.resolve();
            },
        };
        const repositorioTypeOrm = {
            update: manager.update,
            manager: { transaction: (trabajo: (m: typeof manager) => Promise<unknown>) => trabajo(manager) },
        } as unknown as Repository<TypeOrmUsuarioEntity>;

        await new TypeOrmPoliticaDatosRepository(repositorioTypeOrm).revocar("u-1");

        expect(actualizaciones).toContainEqual([
            TypeOrmUsuarioEntity,
            { id: "u-1" },
            { politicaDatosVersion: null, politicaDatosFecha: null },
        ]);
        expect(actualizaciones).toContainEqual([
            TypeOrmProductorEntity,
            { usuarioId: "u-1" },
            { consentimiento: false, fechaConsentimiento: null },
        ]);
    });
});
