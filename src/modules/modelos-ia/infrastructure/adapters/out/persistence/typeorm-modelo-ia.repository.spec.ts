import { IsNull, type Repository } from "typeorm";
import { TypeOrmModeloIaRepository } from "./typeorm-modelo-ia.repository";
import type { TypeOrmModeloIaEntity } from "./typeorm-modelo-ia.entity";
import type { TypeOrmAuditoriaModeloEntity } from "./typeorm-auditoria-modelo.entity";
import { ModeloIa } from "../../../../domain/entities/modelo-ia.entity";
import { ReglaNegocioError } from "../../../../../../common/errors/regla-negocio.error";

jest.mock("@nestjs/typeorm", () => ({ InjectRepository: () => () => undefined }));
jest.mock("uuid", () => ({ v4: () => crypto.randomUUID() }));

// Sin PostgreSQL: se comprueba la condición del UPDATE optimista
describe("TypeOrmModeloIaRepository.guardarCambios", () => {
    const update = jest.fn<Promise<{ affected: number }>, [unknown, Record<string, unknown>, unknown]>();
    const manager = { update, insert: jest.fn() };
    const repositorio = new TypeOrmModeloIaRepository(
        {
            manager: { transaction: (trabajo: (m: typeof manager) => Promise<void>) => trabajo(manager) },
        } as unknown as Repository<TypeOrmModeloIaEntity>,
        {} as Repository<TypeOrmAuditoriaModeloEntity>,
    );

    const borrador = () =>
        ModeloIa.registrar({
            id: "m-1",
            version: "1.0.0",
            formato: "tflite",
            versionMinApp: "2.0.0",
            artefactos: {
                rutaModelo: "modelos/1.0.0/modelo",
                rutaEtiquetas: "modelos/1.0.0/etiquetas-1",
                rutaCalibracion: null,
                tamanoBytes: 1,
                sha256: "ab".repeat(32),
                firma: null,
                numeroClases: 2,
                clases: ["A", "B"],
            },
            creadoPor: "u-admin",
        });

    beforeEach(() => update.mockReset().mockResolvedValue({ affected: 1 }));

    it("solo guarda si las rutas de los artefactos siguen siendo las que se leyeron", async () => {
        const modelo = borrador();
        modelo.completarArtefactos({
            rutaEtiquetas: "modelos/1.0.0/etiquetas-2",
            rutaCalibracion: "modelos/1.0.0/calibracion-1",
            firma: "firma",
            numeroClases: 2,
            clases: ["A", "B"],
        });

        await repositorio.guardarCambios([modelo], []);

        expect(update.mock.calls[0][1]).toEqual({
            id: "m-1",
            canal: "borrador",
            killSwitch: false,
            rutaEtiquetas: "modelos/1.0.0/etiquetas-1",
            rutaCalibracion: IsNull(),
        });
    });

    it("si otra edición cambió los artefactos entretanto, no pisa sus rutas", async () => {
        update.mockResolvedValue({ affected: 0 });

        await expect(repositorio.guardarCambios([borrador()], [])).rejects.toBeInstanceOf(ReglaNegocioError);
    });
});
