// Ejecuta en orden, una tras otra, las tareas que comparten clave; las de claves distintas corren en
// paralelo. Sirve para reglas "consultar y luego guardar" (cupos, esperas) que, en paralelo, verían todas
// el mismo estado. Es por proceso, como el resto de los límites en memoria de la API (throttler,
// presupuesto de registros OTP): con varias instancias haría falta un bloqueo en la base de datos.
export class ColaPorClave {
    private readonly colas = new Map<string, Promise<unknown>>();

    async ejecutar<T>(clave: string, tarea: () => Promise<T>): Promise<T> {
        const anterior = this.colas.get(clave) ?? Promise.resolve();
        // El fallo de la tarea anterior no bloquea a la siguiente
        const actual = anterior.catch(() => undefined).then(tarea);
        this.colas.set(clave, actual);

        try {
            return await actual;
        } finally {
            // Si nadie se encoló detrás, la clave se libera y el mapa no crece sin límite
            if (this.colas.get(clave) === actual) this.colas.delete(clave);
        }
    }
}
