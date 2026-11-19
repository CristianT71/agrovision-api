import { DataSource } from "typeorm";
import { TypeOrmCorrelacionAppAdapter } from "./typeorm-correlacion-app.adapter";

describe("TypeOrmCorrelacionAppAdapter", () => {
    it("filtra consentimiento vigente y coordenadas de ambos orígenes en SQL; excluye defectuosas", async () => {
        const query = jest.fn().mockResolvedValue([
            {
                registros: [],
                resumen: {
                    total: 0,
                    porOrigen: { deteccion: 0, solicitud: 0 },
                    porClase: [],
                    fechaMin: null,
                    fechaMax: null,
                },
            },
        ]);
        const adapter = new TypeOrmCorrelacionAppAdapter({ query } as unknown as DataSource);
        const r = await adapter.consultar({ sur: 4, norte: 5, oeste: -75, este: -74 });
        const [sql, params] = query.mock.calls[0];
        expect(params).toEqual([4, 5, -75, -74]);
        expect(sql.match(/p.consentimiento IS TRUE/g)).toHaveLength(2);
        expect(sql).toContain("d.defectuosa IS NOT TRUE");
        for (const alias of ["d", "s"]) {
            expect(sql).toContain(`${alias}.latitud IS NOT NULL AND ${alias}.longitud IS NOT NULL`);
            expect(sql).toContain(`p.id = ${alias}.productor_id`);
        }
        expect(sql).toContain("latitud BETWEEN $1 AND $2");
        expect(sql).toContain("longitud + 360 BETWEEN $3 AND $4");
        expect(sql).toContain("LIMIT 500");
        expect(sql).toContain("FROM coincidencias GROUP BY clase");
        // Las solicitudes con ubicación simulada no son posiciones reales: se excluyen. No se filtra por ubicacion_exacta
        expect(sql).toMatch(/s\.ubicacion_simulada IS NOT TRUE/);
        expect(sql).not.toMatch(/ubicacion_exacta|nombre|telefono/);
        expect(r.registros).toEqual([]);
        expect(r.resumen.fechaMin).toBeNull();
    });
    it("proyecta solo campos públicos y normaliza fechas sin zona como las lecturas pg", async () => {
        const fecha = "2026-01-01T10:30:00";
        const query = jest.fn().mockResolvedValue([
            {
                registros: [
                    {
                        origen: "solicitud",
                        clase: null,
                        confianza: null,
                        fecha,
                        latitud: 4,
                        longitud: -74,
                        productor_id: "privado",
                        nombre: "privado",
                    },
                ],
                resumen: {
                    total: 1,
                    porOrigen: { deteccion: 0, solicitud: 1 },
                    porClase: [{ clase: null, total: 1 }],
                    fechaMin: fecha,
                    fechaMax: fecha,
                },
            },
        ]);
        const r = await new TypeOrmCorrelacionAppAdapter({ query } as unknown as DataSource).consultar({
            sur: 3,
            norte: 5,
            oeste: -75,
            este: -73,
        });
        expect(r.registros[0]).toEqual({
            origen: "solicitud",
            clase: null,
            confianza: null,
            fecha: new Date(fecha).toISOString(),
            latitud: 4,
            longitud: -74,
        });
        expect(r.resumen.fechaMax).toBe(new Date(fecha).toISOString());
        expect(JSON.stringify(r)).not.toContain("privado");
    });
});
