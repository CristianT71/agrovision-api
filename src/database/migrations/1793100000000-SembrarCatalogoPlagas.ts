import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Siembra el catálogo inicial de fichas (el mismo que viaja empaquetado en la app móvil,
 * App-Coffe-check/app/src/main/assets/catalog/pests.json) para que el panel no arranque vacío.
 *
 * - Los ids son UUID v5 deterministas derivados del id de la app ("agrovision:plaga:<id>").
 * - Las fichas nacen SIN aval: el protocolo químico solo se libera con la firma de un agrónomo (RF-05.7).
 * - Es idempotente: no pisa fichas que ya existan (ni por id ni por nombre científico).
 */
export class SembrarCatalogoPlagas1793100000000 implements MigrationInterface {
    name = "SembrarCatalogoPlagas1793100000000";

    private readonly fichas = [
        {
            "id": "dd8cfa55-a7a6-5e64-80b3-32c106f5ff19",
            "appId": "Enfermedad_Roya",
            "nombreComun": "Roya de Café",
            "nombreCientifico": "Hemileia vastatrix",
            "tipo": "enfermedad",
            "descripcion": "Esta enfermedad se manifiesta a través de manchas amarillas en las hojas que eventualmente se vuelven rojizas, acompañadas por un polvo anaranjado constituido por esporas del hongo. Estas manchas interfieren con la fotosíntesis, debilitando la planta y reduciendo la producción de café.",
            "sintomas": "Esta enfermedad se manifiesta a través de manchas amarillas en las hojas que eventualmente se vuelven rojizas, acompañadas por un polvo anaranjado constituido por esporas del hongo. Estas manchas interfieren con la fotosíntesis, debilitando la planta y reduciendo la producción de café.",
            "organos": [
                "hoja"
            ],
            "medidas": "Pendiente de revisión por un agrónomo: aún no hay medidas de contención avaladas para esta ficha.",
            "quimico": "Para controlar la roya del café, es fundamental el uso de fungicidas como el óxido de cobre, que ayudan a prevenir la propagación del hongo. También es crucial el manejo adecuado de la sombra para reducir la humedad en el follaje, lo que disminuye las condiciones favorables para el hongo. La renovación de plantaciones con variedades resistentes a la roya es otra estrategia importante para mitigar el impacto de esta enfermedad.",
            "sinonimos": []
        },
        {
            "id": "c3e5bbaa-8ede-5235-b50a-1d815216d938",
            "appId": "Enfermedad_ManchadeHierro",
            "nombreComun": "Mancha de Hierro",
            "nombreCientifico": "Cercospora coffeicola",
            "tipo": "enfermedad",
            "descripcion": "Las hojas afectadas presentan pequeñas manchas de color marrón oscuro a negro, que se expanden y fusionan, causando la caída prematura de las hojas y el debilitamiento general del árbol. Estas manchas pueden cubrir grandes áreas de la hoja, interfiriendo con su capacidad fotosintética.",
            "sintomas": "Las hojas afectadas presentan pequeñas manchas de color marrón oscuro a negro, que se expanden y fusionan, causando la caída prematura de las hojas y el debilitamiento general del árbol. Estas manchas pueden cubrir grandes áreas de la hoja, interfiriendo con su capacidad fotosintética.",
            "organos": [
                "hoja"
            ],
            "medidas": "Pendiente de revisión por un agrónomo: aún no hay medidas de contención avaladas para esta ficha.",
            "quimico": "La rotación de cultivos es una práctica efectiva para reducir la incidencia de la mancha de hierro, ya que interrumpe el ciclo de vida del hongo. El manejo adecuado de la sombra también es crucial, ya que reduce la humedad en el follaje, limitando las condiciones favorables para el hongo. El uso de fungicidas sistémicos puede ayudar a controlar la enfermedad, aunque es importante seguir las recomendaciones específicas para evitar la resistencia del hongo.",
            "sinonimos": []
        },
        {
            "id": "86d53402-e95a-52a7-ab5d-b8b469fb7eeb",
            "appId": "Enfermedad_OjodeGallo",
            "nombreComun": "Ojo de Gallo del Café",
            "nombreCientifico": "Mycena citricolor",
            "tipo": "enfermedad",
            "descripcion": "Esta enfermedad se caracteriza por manchas circulares de color marrón oscuro en las hojas, que pueden provocar la muerte del tejido afectado y una severa defoliación. Las manchas a menudo tienen un borde más claro y un centro más oscuro, lo que les da un aspecto distintivo.",
            "sintomas": "Esta enfermedad se caracteriza por manchas circulares de color marrón oscuro en las hojas, que pueden provocar la muerte del tejido afectado y una severa defoliación. Las manchas a menudo tienen un borde más claro y un centro más oscuro, lo que les da un aspecto distintivo.",
            "organos": [
                "hoja"
            ],
            "medidas": "Pendiente de revisión por un agrónomo: aún no hay medidas de contención avaladas para esta ficha.",
            "quimico": "Para controlar el ojo de gallo del café, es fundamental mantener el cultivo en zonas sombreadas, con un 30-40% de sombra, lo que ayuda a reducir la humedad excesiva. El control de malezas es crucial, ya que estas pueden ser hospedadoras de hongos que afectan la planta. Las aplicaciones de fungicidas con altas concentraciones de cobre y azufre también son efectivas para prevenir y controlar esta enfermedad.",
            "sinonimos": []
        },
        {
            "id": "d5741c2b-1604-5c68-ab7f-3f2a9309087d",
            "appId": "Enfermedad_Antracnosis",
            "nombreComun": "Antracnosis del Café",
            "nombreCientifico": "Colletotrichum spp.",
            "tipo": "enfermedad",
            "descripcion": "Lesiones necróticas en hojas, ramas y frutos, con puntos negros o anillos oscuros en las manchas.",
            "sintomas": "Lesiones necróticas en hojas, ramas y frutos, con puntos negros o anillos oscuros en las manchas.",
            "organos": [
                "hoja",
                "fruto"
            ],
            "medidas": "Pendiente de revisión por un agrónomo: aún no hay medidas de contención avaladas para esta ficha.",
            "quimico": "Eliminación de residuos vegetales, uso de fungicidas específicos, y prácticas de manejo integrado de plagas y enfermedades.",
            "sinonimos": []
        },
        {
            "id": "7bf4dc8f-0d24-5f8a-b360-de25f56b3a78",
            "appId": "Deficiencia_Azufre",
            "nombreComun": "Deficiencia de Azufre-S",
            "nombreCientifico": null,
            "tipo": "deficiencia",
            "descripcion": "La deficiencia de azufre se manifiesta con un amarillamiento uniforme de las hojas más nuevas del árbol de café, mientras que las hojas más viejas próximas al ápice de las ramas permanecen verdes. Esta condición afecta el crecimiento general de la planta y puede reducir significativamente la productividad.",
            "sintomas": "La deficiencia de azufre se manifiesta con un amarillamiento uniforme de las hojas más nuevas del árbol de café, mientras que las hojas más viejas próximas al ápice de las ramas permanecen verdes. Esta condición afecta el crecimiento general de la planta y puede reducir significativamente la productividad.",
            "organos": [
                "hoja"
            ],
            "medidas": "Para prevenir la deficiencia de azufre, es esencial la conservación del suelo mediante prácticas que eviten la erosión. La aplicación de abonos orgánicos y planes de fertilización que incluyan azufre son cruciales para mantener niveles adecuados de este nutriente en el suelo. Además, es importante monitorear regularmente los niveles de azufre en el suelo y ajustar las prácticas de fertilización según sea necesario.",
            "quimico": null,
            "sinonimos": []
        },
        {
            "id": "9c469f9c-409a-53df-a013-62be21218c1b",
            "appId": "Deficiencia_Potasio",
            "nombreComun": "Deficiencia de Potasio-K",
            "nombreCientifico": null,
            "tipo": "deficiencia",
            "descripcion": "La deficiencia de potasio se presenta con necrosis en la punta y los bordes de las hojas más viejas del árbol de café. Esta condición puede causar una reducción en el tamaño de los frutos, especialmente en el grosor de la pulpa, afectando la calidad y cantidad de la cosecha.",
            "sintomas": "La deficiencia de potasio se presenta con necrosis en la punta y los bordes de las hojas más viejas del árbol de café. Esta condición puede causar una reducción en el tamaño de los frutos, especialmente en el grosor de la pulpa, afectando la calidad y cantidad de la cosecha.",
            "organos": [
                "hoja",
                "fruto"
            ],
            "medidas": "La deficiencia de potasio se puede prevenir mediante la aplicación de abonos orgánicos ricos en este nutriente, como la pulpa de café. También es importante llevar un control riguroso de plagas y enfermedades que afectan las raíces, ya que estas pueden interferir con la absorción de potasio. El monitoreo regular de los niveles de potasio en el suelo y la aplicación oportuna de fertilizantes potásicos son esenciales para mantener la salud y productividad de la planta.",
            "quimico": null,
            "sinonimos": []
        },
        {
            "id": "27f3d9ea-5211-5583-a683-b8891da1e561",
            "appId": "Enfermedad_Phoma",
            "nombreComun": "Quema del Cogollo",
            "nombreCientifico": "Phoma spp.",
            "tipo": "enfermedad",
            "descripcion": "Aparece como lesiones oscuras de borde irregular que empiezan en el borde de la hoja o en el cogollo y avanzan hacia adentro, con aspecto de quemadura. El tejido afectado se vuelve pardo oscuro y quebradizo. Ataca sobre todo las partes jóvenes de la planta y se favorece con temperaturas bajas, vientos fríos y humedad alta, condiciones frecuentes en cafetales de altura. Cuando alcanza el cogollo detiene el crecimiento de la rama.",
            "sintomas": "Aparece como lesiones oscuras de borde irregular que empiezan en el borde de la hoja o en el cogollo y avanzan hacia adentro, con aspecto de quemadura. El tejido afectado se vuelve pardo oscuro y quebradizo. Ataca sobre todo las partes jóvenes de la planta y se favorece con temperaturas bajas, vientos fríos y humedad alta, condiciones frecuentes en cafetales de altura. Cuando alcanza el cogollo detiene el crecimiento de la rama.",
            "organos": [
                "hoja",
                "tallo",
                "fruto"
            ],
            "medidas": "Pendiente de revisión por un agrónomo: aún no hay medidas de contención avaladas para esta ficha.",
            "quimico": null,
            "sinonimos": [
                "quema",
                "muerte descendente",
                "phoma"
            ]
        },
        {
            "id": "f07804ae-b272-514f-bec4-b96013f87c10",
            "appId": "Plaga_Minador",
            "nombreComun": "Minador de la Hoja",
            "nombreCientifico": "Leucoptera coffeella",
            "tipo": "plaga",
            "descripcion": "No es un hongo sino un insecto: la larva de una pequeña palomilla se mete entre las dos capas de la hoja y va comiendo por dentro. Deja galerías o manchas pardas de contorno irregular, secas al tacto, que al mirarlas a contraluz se ven huecas. Es la diferencia clave con una enfermedad: la lesión está vacía por dentro. Las hojas muy atacadas se caen, y el árbol pierde área para hacer fotosíntesis justo cuando llena el grano.",
            "sintomas": "No es un hongo sino un insecto: la larva de una pequeña palomilla se mete entre las dos capas de la hoja y va comiendo por dentro. Deja galerías o manchas pardas de contorno irregular, secas al tacto, que al mirarlas a contraluz se ven huecas. Es la diferencia clave con una enfermedad: la lesión está vacía por dentro. Las hojas muy atacadas se caen, y el árbol pierde área para hacer fotosíntesis justo cuando llena el grano.",
            "organos": [
                "hoja"
            ],
            "medidas": "Pendiente de revisión por un agrónomo: aún no hay medidas de contención avaladas para esta ficha.",
            "quimico": null,
            "sinonimos": [
                "minador",
                "palomilla del cafeto"
            ]
        }
    ];

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const f of this.fichas) {
            await queryRunner.query(
                `INSERT INTO "plagas" ("id","nombre_comun","nombre_cientifico","tipo","descripcion","sintomas","cultivo","organos_afectados","hospederos","medidas_contencion","protocolo_quimico")
                 VALUES ($1,$2,$3,$4,$5,$6,'cafe',$7,'{}',$8,$9) ON CONFLICT DO NOTHING`,
                [f.id, f.nombreComun, f.nombreCientifico, f.tipo, f.descripcion, f.sintomas, f.organos, f.medidas, f.quimico],
            );
            for (const s of f.sinonimos) {
                await queryRunner.query(
                    `INSERT INTO "sinonimos_plaga" ("id","plaga_id","sinonimo")
                     SELECT gen_random_uuid(), $1, $2 WHERE EXISTS (SELECT 1 FROM "plagas" WHERE "id" = $1) ON CONFLICT DO NOTHING`,
                    [f.id, s],
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "plagas" WHERE "id" = ANY($1::uuid[])`, [this.fichas.map((f) => f.id)]);
    }
}
