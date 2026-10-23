import { applyDecorators } from "@nestjs/common";
import { Transform } from "class-transformer";
import {
    IsNotEmpty,
    IsString,
    Validate,
    ValidatorConstraint,
    type ValidatorConstraintInterface,
} from "class-validator";
import { MENSAJE_TELEFONO_INVALIDO, normalizarTelefono } from "../utils/telefono";

@ValidatorConstraint({ name: "telefonoInternacional", async: false })
class TelefonoInternacionalConstraint implements ValidatorConstraintInterface {
    // Llega ya normalizado por el @Transform: si sigue sin coincidir, el número no es válido
    validate(valor: unknown): boolean {
        return typeof valor === "string" && normalizarTelefono(valor) === valor;
    }

    defaultMessage(): string {
        return MENSAJE_TELEFONO_INVALIDO;
    }
}

// Normaliza el teléfono a E.164 antes de validarlo, así el servicio y la base de datos solo ven "+57..."
export function TelefonoInternacional() {
    return applyDecorators(
        Transform(({ value }: { value: unknown }) =>
            typeof value === "string" ? (normalizarTelefono(value) ?? value) : value,
        ),
        IsString({ message: "El teléfono debe ser un texto." }),
        IsNotEmpty({ message: "El número de teléfono es obligatorio." }),
        Validate(TelefonoInternacionalConstraint),
    );
}
