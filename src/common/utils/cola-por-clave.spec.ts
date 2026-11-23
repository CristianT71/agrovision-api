import { ColaPorClave } from "./cola-por-clave";

describe("ColaPorClave", () => {
    const pausa = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

    it("ejecuta en serie las tareas de la misma clave y en paralelo las de claves distintas", async () => {
        const cola = new ColaPorClave();
        const orden: string[] = [];
        const tarea = (nombre: string, ms: number) => async () => {
            orden.push(`inicio ${nombre}`);
            await pausa(ms);
            orden.push(`fin ${nombre}`);
        };

        await Promise.all([
            cola.ejecutar("a", tarea("a1", 10)),
            cola.ejecutar("a", tarea("a2", 1)),
            cola.ejecutar("b", tarea("b1", 1)),
        ]);

        expect(orden.indexOf("fin a1")).toBeLessThan(orden.indexOf("inicio a2"));
        expect(orden.indexOf("inicio b1")).toBeLessThan(orden.indexOf("fin a1"));
    });

    it("un fallo no bloquea a la siguiente tarea y se propaga a quien la pidió", async () => {
        const cola = new ColaPorClave();

        const fallida = cola.ejecutar("a", () => Promise.reject(new Error("falla")));
        const siguiente = cola.ejecutar("a", () => Promise.resolve("ok"));

        await expect(fallida).rejects.toThrow("falla");
        await expect(siguiente).resolves.toBe("ok");
    });
});
