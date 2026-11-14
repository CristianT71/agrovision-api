import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { DataSource } from "typeorm";
import { GestionReglasZonaService } from "../../../../application/use-cases/gestion-reglas-zona.service";
import { FILAS_EJEMPLO } from "../../../../domain/testing/filas-ejemplo";
import { TypeOrmReglasZonaRepository } from "./typeorm-reglas-zona.repository";
import { TypeOrmUnidadTrabajoReglasZona } from "./typeorm-unidad-trabajo-reglas-zona";

// Prueba contra un PostgreSQL LOCAL real (bloqueos y transacciones no se pueden simular con dobles).
// No corre con `npx jest`: hay que pedirla con PRUEBA_BD_REGLAS_ZONA=1 y solo acepta DB_HOST local.
// Usa un tipo de enfermedad propio y borra sus reglas al terminar; no deja filas de auditoría
// (la única que se intenta falla a propósito y se revierte).
config();
const HOST = process.env.DB_HOST || "localhost";
const habilitada = process.env.PRUEBA_BD_REGLAS_ZONA === "1" && ["localhost", "127.0.0.1"].includes(HOST);

(habilitada ? describe : describe.skip)("Reglas de zona contra PostgreSQL local", () => {
    const tipo = `prueba-conc-${randomUUID().slice(0, 8)}`;
    const otrasFilas = FILAS_EJEMPLO.map((f) => ({ ...f, radioMaxM: f.radioMaxM + 1 }));
    let db: DataSource;
    let lectura: TypeOrmReglasZonaRepository;
    let versiones = 0;

    const sembrar = async () => {
        const id = randomUUID();
        versiones += 1;
        await db.transaction(async (tx) => {
            await tx.query(`INSERT INTO reglas_zona (id,tipo_enfermedad,version) VALUES ($1,$2,$3)`, [
                id,
                tipo,
                versiones,
            ]);
            for (const f of FILAS_EJEMPLO)
                await tx.query(
                    `INSERT INTO reglas_zona_filas (regla_id,orden,sev_max,inc_max,radio_min_m,radio_max_m) VALUES ($1,$2,$3,$4,$5,$6)`,
                    [id, f.orden, f.sevMax, f.incMax, f.radioMinM, f.radioMaxM],
                );
        });
        return id;
    };

    // Una edición completa como la hace el caso de uso, pero sin auditoría (no ensuciar el historial inmutable).
    const editar = (id: string, revision: number, cambios: { notas?: string; filas?: typeof FILAS_EJEMPLO }) =>
        db.transaction(async (tx) => {
            const reglas = new TypeOrmReglasZonaRepository(tx);
            const regla = await reglas.obtenerParaModificar(id);
            if (!regla) throw new Error("no existe");
            regla.exigirRevision(revision);
            regla.editar(cambios);
            if (!(await reglas.guardarBorrador(regla, revision, cambios.filas !== undefined)))
                throw new Error("no guardó");
            return regla.revision;
        });

    beforeAll(async () => {
        db = new DataSource({
            type: "postgres",
            host: HOST,
            port: parseInt(process.env.DB_PORT || "5432", 10),
            username: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });
        await db.initialize();
        lectura = new TypeOrmReglasZonaRepository(db.manager);
    });

    afterAll(async () => {
        await db.query(`DELETE FROM reglas_zona WHERE tipo_enfermedad=$1`, [tipo]);
        await db.destroy();
    });

    it("la migración deja las reglas en revisión 1 y la lectura la devuelve con sus filas", async () => {
        const id = await sembrar();
        const regla = await lectura.obtener(id);
        expect(regla?.revision).toBe(1);
        expect(regla?.filas).toEqual(FILAS_EJEMPLO);
    });

    it("dos ediciones simultáneas con la misma revisión: una gana y la otra recibe VERSION_EN_CONFLICTO", async () => {
        const id = await sembrar();
        const resultados = await Promise.allSettled([
            editar(id, 1, { filas: otrasFilas }),
            editar(id, 1, { notas: "segunda" }),
        ]);
        expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        const rechazada = resultados.find((r) => r.status === "rejected");
        expect(rechazada?.reason).toMatchObject({ codigo: "VERSION_EN_CONFLICTO" });
        expect((await lectura.obtener(id))?.revision).toBe(2);
    });

    it("un guardado de solo notas no pisa las filas guardadas por la edición anterior", async () => {
        const id = await sembrar();
        expect(await editar(id, 1, { filas: otrasFilas })).toBe(2);
        expect(await editar(id, 2, { notas: "solo notas" })).toBe(3);
        const regla = await lectura.obtener(id);
        expect(regla?.filas).toEqual(otrasFilas);
        expect(regla?.vista().notas).toBe("solo notas");
    });

    it("el UPDATE condicionado no aplica con una revisión antigua, ni al guardar ni al aprobar", async () => {
        const id = await sembrar();
        await editar(id, 1, { filas: otrasFilas });
        const obsoleta = await lectura.obtener(id);
        obsoleta.editar({ notas: "desde una instantánea vieja" });
        expect(await lectura.guardarBorrador(obsoleta, 1, true)).toBe(false);
        obsoleta.aprobar({ nombre: "Ana", tarjetaProfesional: "TP" }, randomUUID(), { calibrada: false }, new Date());
        expect(await lectura.guardarAprobacion(obsoleta, 1)).toBe(false);
        expect((await lectura.obtener(id))?.vista()).toMatchObject({ estado: "borrador", revision: 2, notas: null });
    });

    it("si la auditoría falla, el cambio se revierte entero (misma transacción)", async () => {
        const id = await sembrar();
        const servicio = new GestionReglasZonaService(lectura, new TypeOrmUnidadTrabajoReglasZona(db), {
            agronomoValidado: () => Promise.resolve(null),
        });
        // El actor no existe en usuarios: el INSERT de auditoría viola su FK después de haber guardado la regla.
        const actor = { id: randomUUID(), rol: "admin" };
        await expect(servicio.editar(actor, id, { revision: 1, notas: "no debe quedar" })).rejects.toMatchObject({
            code: "23503",
        });
        expect((await lectura.obtener(id))?.vista()).toMatchObject({ revision: 1, notas: null });
        await expect(servicio.eliminar(actor, id)).rejects.toMatchObject({ code: "23503" });
        expect(await lectura.obtener(id)).not.toBeNull();
        const [{ total }] = await db.query<{ total: number }[]>(
            `SELECT COUNT(*)::int AS total FROM auditoria_reglas_zona WHERE regla_id=$1`,
            [id],
        );
        expect(total).toBe(0);
    });
});
