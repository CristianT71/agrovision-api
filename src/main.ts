import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "node:path";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { directorioArchivos } from "./common/almacenamiento/local-almacenamiento.adapter";
import { OPCIONES_FOTOS_CATALOGO, soloFotosCatalogo } from "./common/almacenamiento/fotos-catalogo-publicas";
import { leerOrigenesCors, leerSaltosProxy } from "./config/servidor";

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.setGlobalPrefix("api");

    // Solo la carpeta pública (fotos del catálogo) se sirve directo; las acreditaciones no
    app.use("/archivos/plagas", soloFotosCatalogo);
    app.useStaticAssets(join(directorioArchivos(), "publico", "plagas"), OPCIONES_FOTOS_CATALOGO);

    // Detrás de un túnel o proxy, la IP real del cliente viene en X-Forwarded-For
    const saltosProxy = leerSaltosProxy(process.env.TRUST_PROXY);
    if (saltosProxy > 0) app.set("trust proxy", saltosProxy);

    app.enableCors({ origin: leerOrigenesCors(process.env.CORS_ORIGINS) });

    // El lote de capturas admite 100 elementos con embedding: el límite por defecto (100 KB) se queda corto
    app.useBodyParser("json", { limit: "1mb" });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
