import { IsString, Matches, MaxLength } from "class-validator";

// Mismas reglas que valida el flujo 01 de n8n, para rechazar aquí sin gastar saldo del modelo.
export class MensajeAsistenteDto {
    @IsString() @Matches(/^[A-Za-z0-9-]{8,64}$/) sessionId: string;
    @IsString() @Matches(/\S/) @MaxLength(4000) chatInput: string;
}
// Código del enlace de descarga que genera el flujo 03: <vencimiento>-<48 hex>, con ".pdf" opcional.
export class ConsultarInformeDto {
    @IsString() @Matches(/^\d{10}-[a-f0-9]{48}(\.pdf)?$/i) t: string;
}
