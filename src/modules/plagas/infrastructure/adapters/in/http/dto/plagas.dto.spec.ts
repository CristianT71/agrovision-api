import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ActualizarPlagaDto, CrearPlagaDto } from "./plagas.dto";

const propiedadesConError = async (dto: object) => (await validate(dto)).map((error) => error.property);

const CREAR_VALIDO = {
    nombreComun: "Roya",
    tipo: "enfermedad",
    descripcion: "Hongo foliar",
    sintomas: "Manchas amarillas",
    organosAfectados: ["hoja"],
    medidasContencion: "Fungicida cúprico",
};

describe("DTO de plagas: null no cuenta como campo omitido", () => {
    it("ActualizarPlagaDto rechaza null en los campos obligatorios de la ficha", async () => {
        const dto = plainToInstance(ActualizarPlagaDto, {
            nombreComun: null,
            descripcion: null,
            organosAfectados: null,
            cultivo: null,
        });

        expect(await propiedadesConError(dto)).toEqual(
            expect.arrayContaining(["nombreComun", "descripcion", "organosAfectados", "cultivo"]),
        );
    });

    it("ActualizarPlagaDto sigue aceptando campos omitidos y nombreCientifico en null", async () => {
        const dto = plainToInstance(ActualizarPlagaDto, { nombreCientifico: null });

        expect(await propiedadesConError(dto)).toEqual([]);
    });

    it("CrearPlagaDto rechaza null en las listas y el cultivo opcionales", async () => {
        const dto = plainToInstance(CrearPlagaDto, { ...CREAR_VALIDO, cultivo: null, hospederos: null });

        expect((await propiedadesConError(dto)).sort()).toEqual(["cultivo", "hospederos"]);
    });
});
