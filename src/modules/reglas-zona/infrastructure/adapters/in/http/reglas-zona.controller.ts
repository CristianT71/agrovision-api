import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Inject,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
    UseFilters,
    UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../../../../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../../../../../common/guards/roles.guard";
import { Roles } from "../../../../../../common/decorators/roles.decorator";
import { UsuarioActual, type UsuarioAutenticado } from "../../../../../../common/decorators/usuario-actual.decorator";
import { GESTION_REGLAS_ZONA, type Actor, type IGestionReglasZona } from "../../../../domain/ports/in/reglas-zona.port";
import {
    AprobarReglaZonaDto,
    ConsultarReglasZonaDto,
    CrearReglaZonaDto,
    EditarReglaZonaDto,
    SimularReglaZonaDto,
} from "./dto/reglas-zona.dto";
import { ReglasZonaExceptionFilter } from "./reglas-zona-exception.filter";

const actor = (u: UsuarioAutenticado): Actor => ({ id: u.id, rol: u.rol });

@Controller("reglas-zona")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin", "agronomo")
@UseFilters(ReglasZonaExceptionFilter)
export class ReglasZonaController {
    constructor(@Inject(GESTION_REGLAS_ZONA) private readonly gestion: IGestionReglasZona) {}

    @Get() listar(@Query() dto: ConsultarReglasZonaDto) {
        return this.gestion.listar({ tipo: dto.tipo, estado: dto.estado });
    }

    @Post() crear(@Body() dto: CrearReglaZonaDto, @UsuarioActual() usuario: UsuarioAutenticado) {
        return this.gestion.crear(actor(usuario), {
            tipoEnfermedad: dto.tipoEnfermedad,
            notas: dto.notas ?? null,
            filas: dto.filas,
        });
    }

    @Get(":id") obtener(@Param("id", ParseUUIDPipe) id: string) {
        return this.gestion.obtener(id);
    }

    @Patch(":id") editar(
        @Param("id", ParseUUIDPipe) id: string,
        @Body() dto: EditarReglaZonaDto,
        @UsuarioActual() usuario: UsuarioAutenticado,
    ) {
        return this.gestion.editar(actor(usuario), id, { revision: dto.revision, notas: dto.notas, filas: dto.filas });
    }

    @Delete(":id") @HttpCode(204) eliminar(
        @Param("id", ParseUUIDPipe) id: string,
        @UsuarioActual() usuario: UsuarioAutenticado,
    ) {
        return this.gestion.eliminar(actor(usuario), id);
    }

    @Post(":id/duplicar") duplicar(
        @Param("id", ParseUUIDPipe) id: string,
        @UsuarioActual() usuario: UsuarioAutenticado,
    ) {
        return this.gestion.duplicar(actor(usuario), id);
    }

    // Solo el agrónomo aprueba; el caso de uso además exige que su cuenta esté validada.
    @Post(":id/aprobar")
    @Roles("agronomo")
    @HttpCode(200)
    aprobar(
        @Param("id", ParseUUIDPipe) id: string,
        @Body() dto: AprobarReglaZonaDto,
        @UsuarioActual() usuario: UsuarioAutenticado,
    ) {
        return this.gestion.aprobar(actor(usuario), id, {
            revision: dto.revision,
            calibrada: dto.calibrada,
            nota: dto.nota ?? null,
        });
    }

    @Post(":id/activar") @HttpCode(200) activar(
        @Param("id", ParseUUIDPipe) id: string,
        @UsuarioActual() usuario: UsuarioAutenticado,
    ) {
        return this.gestion.activar(actor(usuario), id);
    }

    @Post(":id/archivar") @HttpCode(200) archivar(
        @Param("id", ParseUUIDPipe) id: string,
        @UsuarioActual() usuario: UsuarioAutenticado,
    ) {
        return this.gestion.archivar(actor(usuario), id);
    }

    @Post(":id/simular") @HttpCode(200) simular(
        @Param("id", ParseUUIDPipe) id: string,
        @Body() dto: SimularReglaZonaDto,
    ) {
        return this.gestion.simular(id, dto);
    }
}
