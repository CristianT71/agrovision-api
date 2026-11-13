import { Controller, Get, Header, NotFoundException, Param, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { ListarPlagasService } from "../../../../application/use-cases/listar-plagas.service";
import { aFichaPublica } from "./catalogo-publico.mapper";
import { ConsultarCatalogoPublicoDto } from "./dto/consultar-catalogo-publico.dto";

// API pública del catálogo de plagas, enfermedades y deficiencias: SOLO LECTURA y SIN sesión, para que
// otros proyectos (por ejemplo la wiki de otros grupos) la consuman. Entrega una lista blanca de campos
// (ver catalogo-publico.mapper.ts). La marca de ruta pública la da el @Throttle({ publico }) y el CORS
// abierto para esta ruta está en config/servidor.ts. Las rutas internas del catálogo (/plagas) siguen
// exigiendo sesión de agrónomo.
@Controller("public/v1/catalog")
export class CatalogoPublicoLecturaController {
    constructor(
        private readonly listarPlagasService: ListarPlagasService,
        private readonly configService: ConfigService,
    ) {}

    private urlBase(): string {
        return this.configService.get<string>("API_PUBLIC_URL") ?? "";
    }

    @Get()
    @Throttle({ publico: { limit: 60, ttl: 60_000 } })
    @Header("Cache-Control", "public, max-age=60")
    async listar(@Query() filtros: ConsultarCatalogoPublicoDto) {
        const fichas = await this.listarPlagasService.ejecutar({ tipo: filtros.tipo, busqueda: filtros.q });

        return { total: fichas.length, fichas: fichas.map((ficha) => aFichaPublica(ficha, this.urlBase())) };
    }

    // Por el id (UUID) o por la clave legible, por ejemplo "Enfermedad_Roya"
    @Get(":id")
    @Throttle({ publico: { limit: 60, ttl: 60_000 } })
    @Header("Cache-Control", "public, max-age=60")
    async obtener(@Param("id") id: string) {
        const buscada = id.trim().toLowerCase();
        const fichas = (await this.listarPlagasService.ejecutar({})).map((ficha) =>
            aFichaPublica(ficha, this.urlBase()),
        );
        const ficha = fichas.find((f) => f.id.toLowerCase() === buscada || f.clave.toLowerCase() === buscada);

        if (!ficha) throw new NotFoundException("No existe una ficha con ese id o clave.");

        return ficha;
    }
}
