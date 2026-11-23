import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import type { Socket } from "node:net";
import type { INestApplication } from "@nestjs/common";

// Transporte solo de pruebas: ejecuta Express/Nest y busboy reales sin abrir puertos en el sandbox.
export function peticionSinSocket(app: INestApplication) {
    const construir = (metodo: string, url: string) => {
        const headers: Record<string, string> = { host: "localhost" };
        let contenido = Buffer.alloc(0);
        const peticion = {
            set(clave: string, valor: string) {
                headers[clave.toLowerCase()] = valor;
                return peticion;
            },
            send(datos: unknown) {
                headers["content-type"] = "application/json";
                contenido = Buffer.from(JSON.stringify(datos));
                return peticion;
            },
            attach(campo: string, datos: Buffer, nombre: string) {
                const boundary = "vuelos-prueba-boundary";
                headers["content-type"] = `multipart/form-data; boundary=${boundary}`;
                contenido = Buffer.concat([
                    Buffer.from(
                        `--${boundary}\r\nContent-Disposition: form-data; name="${campo}"; filename="${nombre}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
                    ),
                    datos,
                    Buffer.from(`\r\n--${boundary}--\r\n`),
                ]);
                return peticion;
            },
            async expect(status: number): Promise<{ body: any; headers: Record<string, any> }> {
                headers["content-length"] = String(contenido.length);
                const escritos: Buffer[] = [];
                const socket = new Duplex({
                    read() {},
                    write(chunk: Buffer, _encoding, cb) {
                        escritos.push(Buffer.from(chunk));
                        cb();
                    },
                });
                const req = new IncomingMessage(socket as Socket);
                req.method = metodo;
                req.url = url;
                req.headers = headers;
                req.httpVersion = "1.1";
                const res = new ServerResponse(req);
                res.useChunkedEncodingByDefault = false;
                res.assignSocket(socket as Socket);
                await new Promise<void>((resolve, reject) => {
                    res.on("finish", resolve);
                    res.on("error", reject);
                    req.on("error", reject);
                    app.getHttpAdapter().getInstance()(req, res);
                    req.complete = true;
                    req.push(contenido);
                    req.push(null);
                });
                const raw = Buffer.concat(escritos),
                    inicio = raw.indexOf("\r\n\r\n");
                const cuerpo = raw.subarray(inicio + 4).toString("utf8");
                const h = res.getHeaders();
                const body = String(h["content-type"]).includes("application/json") ? JSON.parse(cuerpo) : cuerpo;
                expect(res.statusCode).toBe(status);
                return { body, headers: h };
            },
        };
        return peticion;
    };
    return {
        get: (url: string) => construir("GET", url),
        post: (url: string) => construir("POST", url),
        patch: (url: string) => construir("PATCH", url),
        delete: (url: string) => construir("DELETE", url),
    };
}
