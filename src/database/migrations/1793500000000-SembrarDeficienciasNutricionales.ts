import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Siembra las fichas de las clases nuevas del modelo 3.0: ocho deficiencias nutricionales
 * (boro, calcio, hierro, nitrógeno, fósforo, manganeso, magnesio y zinc) y la hoja sana.
 * Con las siete fichas que ya existían, completan las 16 clases.
 *
 * - Las fichas nacen SIN aval y sin protocolo químico: ese contenido solo lo libera la firma de un
 *   agrónomo (RF-05.7). El texto es descriptivo y debe ser revisado por un profesional.
 * - No traen foto: se suben desde el catálogo del panel.
 * - Es idempotente: no pisa una ficha que ya exista (por id ni por nombre común).
 */
export class SembrarDeficienciasNutricionales1793500000000 implements MigrationInterface {
    name = "SembrarDeficienciasNutricionales1793500000000";

    private static readonly MEDIDAS_PENDIENTES =
        "Pendiente de revisión por un agrónomo: aún no hay medidas de contención avaladas para esta ficha.";

    private readonly fichas = [
        {
            id: "b7109286-aa5c-4c52-ab91-15329f568d28",
            nombreComun: "Deficiencia de Boro-B",
            tipo: "deficiencia",
            descripcion:
                "El boro es un micronutriente que la planta necesita para formar brotes, flores y frutos nuevos. Su falta es más común en suelos ácidos, muy lavados o con poca materia orgánica, y en épocas de sequía prolongada.",
            sintomas:
                "Se ve primero en las hojas y brotes nuevos, porque el boro casi no se mueve dentro de la planta. Las hojas jóvenes salen pequeñas, deformes, estrechas, gruesas y quebradizas, a veces con los bordes ondulados o en forma de gancho. Los entrenudos se acortan y las puntas de las ramas se secan, de modo que las ramas pueden quedar en forma de roseta.",
            organos: ["hoja", "brote"],
            sinonimos: ["falta de boro", "deficiencia de B"],
        },
        {
            id: "a2b3224d-01a5-4336-a058-5853cf07690b",
            nombreComun: "Deficiencia de Calcio-Ca",
            tipo: "deficiencia",
            descripcion:
                "El calcio da firmeza a las paredes de las células y es clave en las zonas donde la planta crece. Falta en suelos muy ácidos o con exceso de potasio o magnesio, que le compiten, y no se desplaza bien dentro de la planta.",
            sintomas:
                "Aparece en las hojas y brotes nuevos. Las hojas jóvenes quedan pequeñas y deformes, con los bordes y las puntas quemados o en forma de gancho, y las yemas de la punta pueden morir. El crecimiento de la rama se detiene y las raíces nuevas se desarrollan poco.",
            organos: ["hoja", "brote"],
            sinonimos: ["falta de calcio", "deficiencia de Ca"],
        },
        {
            id: "d3b2f62b-ef92-47de-b174-a6cb89f1b1ad",
            nombreComun: "Deficiencia de Hierro-Fe",
            tipo: "deficiencia",
            descripcion:
                "El hierro es necesario para fabricar clorofila, el pigmento verde de la hoja. En el café suele faltar más por las condiciones del suelo (exceso de cal, encharcamiento o exceso de otros elementos) que porque haya poco hierro. No se mueve dentro de la planta.",
            sintomas:
                "Se ve en las hojas nuevas: se ponen amarillas o casi blancas, pero las nervaduras se mantienen verdes, lo que da un aspecto de red verde sobre fondo amarillo. En casos fuertes la hoja se vuelve casi blanca y sus bordes se queman. Las hojas viejas siguen verdes.",
            organos: ["hoja"],
            sinonimos: ["falta de hierro", "clorosis férrica"],
        },
        {
            id: "b83275df-49a2-420e-add3-dcf4457b3d9a",
            nombreComun: "Deficiencia de Nitrógeno-N",
            tipo: "deficiencia",
            descripcion:
                "El nitrógeno es el elemento que la planta más usa: hace crecer hojas y ramas y sostiene la producción. Falta en suelos pobres en materia orgánica, cuando las lluvias fuertes lo lavan o cuando no se fertiliza lo suficiente. Se mueve dentro de la planta, por eso se nota primero en las hojas viejas.",
            sintomas:
                "Las hojas más viejas se ponen de un verde pálido a amarillo parejo, sin manchas, y luego se caen. Las ramas crecen poco, las hojas nuevas son pequeñas y el cafetal se ve ralo y sin vigor. Si la falta se prolonga, baja la cosecha. A diferencia de la falta de azufre, que se nota primero en las hojas nuevas, aquí el amarillo empieza por abajo.",
            organos: ["hoja"],
            sinonimos: ["falta de nitrógeno", "deficiencia de N"],
        },
        {
            id: "36f38aee-c062-4476-8028-955e4577af8f",
            nombreComun: "Deficiencia de Fósforo-P",
            tipo: "deficiencia",
            descripcion:
                "El fósforo ayuda al desarrollo de las raíces, a la floración y al llenado del fruto. Falta en suelos ácidos que lo fijan, de modo que la planta no puede tomarlo aunque esté en el suelo. Se mueve dentro de la planta y se nota primero en las hojas viejas.",
            sintomas:
                "Las hojas viejas se ponen de un verde oscuro opaco que luego pasa a tonos rojizos o morados, con los bordes secos y manchas muertas. Las hojas caen antes de tiempo, el crecimiento es lento y hay poco desarrollo de raíces y de ramas.",
            organos: ["hoja"],
            sinonimos: ["falta de fósforo", "deficiencia de P"],
        },
        {
            id: "04d50835-802c-498d-8ad1-406cb1de3f01",
            nombreComun: "Deficiencia de Manganeso-Mn",
            tipo: "deficiencia",
            descripcion:
                "El manganeso interviene en la fotosíntesis. Su falta aparece en suelos con poca disponibilidad de este elemento, sobre todo cuando se aplicó demasiada cal. No se mueve bien dentro de la planta.",
            sintomas:
                "Se ve en las hojas jóvenes e intermedias: se ponen amarillas entre las nervaduras, que quedan verdes y forman un dibujo fino de red. Más tarde pueden aparecer pequeñas manchas secas. Se parece a la falta de hierro; la falta de magnesio, en cambio, se nota en las hojas viejas.",
            organos: ["hoja"],
            sinonimos: ["falta de manganeso", "deficiencia de Mn"],
        },
        {
            id: "8e3a7c7b-1424-48ba-a802-bf45159051a7",
            nombreComun: "Deficiencia de Magnesio-Mg",
            tipo: "deficiencia",
            descripcion:
                "El magnesio es el centro de la clorofila, el pigmento verde de la hoja. Falta en suelos ácidos y lavados, o cuando se aplica mucho potasio, que compite con él. Se mueve dentro de la planta y se nota primero en las hojas viejas.",
            sintomas:
                "Las hojas maduras se ponen amarillas entre las nervaduras, mientras la nervadura central y una franja a su lado siguen verdes, con un dibujo parecido a una espina de pescado. Luego el amarillo se vuelve pardo y la hoja se seca y cae. Es frecuente en plantas cargadas de fruto, porque el grano le quita magnesio a las hojas.",
            organos: ["hoja"],
            sinonimos: ["falta de magnesio", "deficiencia de Mg"],
        },
        {
            id: "c07f02d2-74c9-4be8-861d-00554bf85cf6",
            nombreComun: "Deficiencia de Zinc-Zn",
            tipo: "deficiencia",
            descripcion:
                "El zinc ayuda al crecimiento de los brotes y a la formación de las hormonas de crecimiento. Falta en suelos con poco zinc, con pH alto o con mucho fósforo. No se mueve fácil dentro de la planta.",
            sintomas:
                "Afecta los brotes nuevos: las hojas salen pequeñas, angostas y alargadas, a veces amarillentas entre las nervaduras, y se agrupan en la punta de la rama en forma de roseta porque los entrenudos son muy cortos. Los brotes se ven delgados y el crecimiento se detiene.",
            organos: ["hoja", "brote"],
            sinonimos: ["falta de zinc", "deficiencia de Zn"],
        },
        {
            id: "c0b3b861-711a-4a1f-ac90-b52df14786c8",
            nombreComun: "Hoja sana",
            tipo: "sano",
            descripcion:
                "Hoja de café sin enfermedad, plaga ni deficiencia visible. Es la referencia con la que se compara una hoja con problemas.",
            sintomas:
                "Sin síntomas: verde parejo y brillante, de borde liso, sin manchas, polvos, galerías ni deformaciones. Las nervaduras tienen el mismo color que el resto de la hoja y no hay zonas amarillas, rojizas o secas.",
            organos: ["hoja"],
            sinonimos: ["sana", "hoja normal"],
            medidas:
                "No requiere tratamiento. Conviene mantener el manejo regular del cultivo y revisar las plantas con frecuencia.",
        },
    ];

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const ficha of this.fichas) {
            const existentes = (await queryRunner.query(
                `SELECT 1 FROM "plagas" WHERE "id" = $1 OR lower("nombre_comun") = lower($2)`,
                [ficha.id, ficha.nombreComun],
            )) as unknown[];
            if (existentes.length > 0) continue;

            await queryRunner.query(
                `INSERT INTO "plagas" ("id","nombre_comun","nombre_cientifico","tipo","descripcion","sintomas","cultivo","organos_afectados","hospederos","medidas_contencion","protocolo_quimico")
                 VALUES ($1,$2,NULL,$3,$4,$5,'cafe',$6,'{}',$7,NULL)`,
                [
                    ficha.id,
                    ficha.nombreComun,
                    ficha.tipo,
                    ficha.descripcion,
                    ficha.sintomas,
                    ficha.organos,
                    "medidas" in ficha
                        ? ficha.medidas
                        : SembrarDeficienciasNutricionales1793500000000.MEDIDAS_PENDIENTES,
                ],
            );

            for (const sinonimo of ficha.sinonimos) {
                await queryRunner.query(
                    `INSERT INTO "sinonimos_plaga" ("id","plaga_id","sinonimo") VALUES (gen_random_uuid(), $1, $2)`,
                    [ficha.id, sinonimo],
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "plagas" WHERE "id" = ANY($1::uuid[])`, [this.fichas.map((f) => f.id)]);
    }
}
