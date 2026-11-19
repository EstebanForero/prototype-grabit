# Documentación de Grab It

Módulo de seguimiento logístico: reúne correos de despacho y eventos de transporte para aplicar un estado cuando existe evidencia suficiente y retener las excepciones para revisión. La entrega funcional fue aceptada con el cliente y la conexión real con 17TRACK está operativa.

## Elegir una guía

| Necesita… | Abra… |
| --- | --- |
| Registrar compras, revisar guías y atender alertas | [Manual de usuario con capturas](manual-usuario.md) |
| Instalar, configurar, ejecutar o mantener el sistema | [Documentación técnica](documentacion-tecnica.md) |
| Descargar los manuales | [Manual de usuario PDF](manual-usuario.pdf) · [Documentación técnica PDF](documentacion-tecnica.pdf) |
| Presentar el producto y su continuidad | Presentación PDF de 12 diapositivas, entregada por separado |
| Ver el MVP funcionando | [Video narrado · 5:03](https://www.youtube.com/watch?v=Q6-VDQ_lRcY) |
| Revisar el código, pruebas y workflows | [Repositorio principal](../README.md) |
| Revisar el informe completo y los análisis de negocio | [Informe final en Typst](https://typst.app/project/pQ1sG2QUVmHVALKeXiJzrB) |
| Configurar la lectura de eventos con IA | [Sección de IA y variables de entorno](documentacion-tecnica.md#lectura-de-texto-con-ia-xai) |
| Conocer el agente de IA usado para mantenimiento del parser | [Informe y evidencia del arnés](../harness/INFORME.md) |

## Recorrido recomendado para TI

1. Lea el alcance y la arquitectura en la documentación técnica.
2. Instale con los archivos de bloqueo, ejecute la suite y compile la consola.
3. Practique con una base de prueba y respuestas grabadas.
4. Configure el entorno de operación y las credenciales existentes sin incorporarlas al repositorio.
5. Compruebe el buzón, la consulta de guías y el respaldo. Entregue a Compras la dirección de acceso y el manual de usuario.

## Recorrido recomendado para Compras

1. Acceda a la dirección facilitada por TI.
2. Registre la compra y su destino correcto.
3. Revise Cola de hoy y las tarjetas retenidas.
4. En Buzón, confirme que los correos quedaron asociados al pedido correcto.
5. Ante una duda, use las tablas de mensajes y soluciones del manual y comuníquese con el soporte acordado.

## Evidencia y alcance

Los manuales incluyen capturas reales de la consola con datos sintéticos. El MVP combina reglas verificables sobre eventos, destinos y tramos con lectura opcional de texto mediante la API de xAI. Además, un agente de programación asiste el mantenimiento del lector de correos con verificaciones y revisión humana. Los resultados financieros del informe son proyecciones de capacidad y costos y se revisan durante la operación.

Los manuales también están disponibles en PDF en esta carpeta. El informe se entrega por separado en el paquete académico; estas páginas permiten consultar la documentación directamente desde GitHub y mantener sus actualizaciones en el historial.

La presentación vigente se entrega por separado en PDF: 12 diapositivas con la lectura de IA y las 43 pruebas, para 15 minutos entre los cuatro integrantes, incluidos tres minutos de demostración. La propuesta actualizada de continuidad operativa es de COP 9.000.000.
