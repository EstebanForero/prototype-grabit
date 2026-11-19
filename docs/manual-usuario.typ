#set page(paper:"a4", margin:(x:19mm,y:19mm), header:align(right)[#text(size:8pt,fill:rgb("5E6B76"))[GRAB IT · Documentación final]],footer:context align(right)[#text(size:8pt,fill:rgb("5E6B76"))[#counter(page).display()]])
#set text(font:"Fira Sans",size:10pt,lang:"es",fill:rgb("17212B"))
#set par(justify:true,leading:0.63em)
#set heading(numbering:none)
#show heading.where(level:1):it=>block(above:12pt,below:15pt)[#text(size:26pt,weight:"bold",fill:rgb("17324D"))[#it.body]#v(6pt)#line(length:100%,stroke:2pt+rgb("64CCC5"))]
#show heading.where(level:2):it=>block(above:16pt,below:7pt)[#text(size:15pt,weight:"bold",fill:rgb("17324D"))[#it.body]]
#show heading.where(level:3):it=>block(above:10pt,below:5pt)[#text(size:11pt,weight:"bold",fill:rgb("176B87"))[#it.body]]
#set figure(gap:5pt)
#show figure.caption:set text(size:8pt,fill:rgb("5E6B76"))

#let navy=rgb("17324D")
#let blue=rgb("176B87")
#let cyan=rgb("64CCC5")


#set heading(numbering:none)
#show heading.where(level:2):it=>block(above:15pt,below:7pt)[#text(size:14pt,weight:"bold",fill:navy)[#it.body]]
#show heading.where(level:3):it=>block(above:10pt,below:5pt)[#text(size:11pt,weight:"bold",fill:blue)[#it.body]]


#heading(level: 1, numbering: none)[Manual de usuario]
#line(length: 100%, stroke: 1pt + cyan)


#text[#text("GRAB IT · Seguimiento de envíos · Compras y operación · 18 de noviembre de 2026")]

#text[#link("https://github.com/EstebanForero/prototype-grabit/blob/master/docs/README.md")[#text("Centro de documentación")]#text(" · ")#link("https://www.youtube.com/watch?v=Q6-VDQ_lRcY")[#text("Video de demostración (5:03)")]#text(" · ")#link("https://github.com/EstebanForero/prototype-grabit/blob/master/docs/documentacion-tecnica.md")[#text("Guía para TI")]]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("1. Para qué sirve y qué necesita")]]

#text[#text("Este manual está dirigido a quienes compran productos y revisan sus entregas. No necesita saber programar. TI debe haber instalado la consola y darle su dirección. Use un computador con navegador y acceso a la red donde está el sistema.")]

#text[#text("Usted registra la compra. El sistema puede leer la guía del correo de despacho, reunir las novedades de transporte y decidir si actualiza el estado. Si algo no coincide, conserva el estado anterior y muestra una retención para que una persona revise.")]

#text[#text("La solución está terminada y funcionando dentro del alcance aceptado en la reunión con el cliente. La integración real con 17TRACK y las APIs disponibles está conectada. También puede usar ejemplos para practicar sin modificar la operación real. Las capturas de este manual usan datos sintéticos; los números mostrados son ejemplos. La consola es la interfaz entregada para Compras y no reemplaza el portal del cliente ni Control.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("2. Entrar a la consola")]]

+ #text[#text("Abra Chrome, Edge o Firefox.")]
+ #text[#text("Escriba la dirección que le dio TI. Si está en el mismo equipo donde corre el sistema: http://127.0.0.1:8787.")]
+ #text[#text("Confirme que aparecen Cola de hoy, Buzón y Registrar compra.")]

#text[#text("La consola de prueba no pide una cuenta de usuario. Solo debe abrirse en el equipo o la red controlada que TI haya preparado. Si no abre, comunique a TI la dirección y el mensaje que aparece. Si dice que falta compilar la consola, la solución corresponde a TI.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("3. Registrar una compra")]]

#text[#text("Registre el producto antes de que llegue el correo de despacho. Si no está registrado, el sistema no sabrá a qué compra corresponde la guía.")]

#figure(box(width:100%,height:70mm,clip:true)[#image("img/05-registrar-compra.png",width: 100%)], caption: [#text[#text("Registrar compra. Captura de la consola con datos sintéticos.")]])

+ #text[#text("Abra Registrar compra.")]
+ #text[#text("Complete los campos de la tabla.")]
+ #text[#text("Pulse Registrar.")]
+ #text[#text("Abra Cola de hoy y compruebe que el producto aparece en Comprado.")]

#block(width: 100%,breakable:true)[#set text(size: 8.1pt)
#table(columns: (1fr, 2fr),inset:5pt,stroke:0.4pt+rgb("D7E0E5"),table.header(table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Campo")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Qué escribir"))),
[#text[#text("Identificador")]],
[#text[#text("Un nombre corto y único, por ejemplo audifonos-demo")]],
[#text[#text("Modo")]],
[#text[#text("Internacional si pasa por una bodega fuera de Colombia; Nacional si va directo al cliente")]],
[#text[#text("País y ciudad del cliente")]],
[#text[#text("El destino real de entrega; por ejemplo CO y Bogotá")]],
[#text[#text("Tienda")]],
[#text[#text("La tienda que aparece en el correo")]],
[#text[#text("Número de pedido")]],
[#text[#text("El número completo que entregó la tienda, sin confundirlo con la guía")]],
)]

#text[#text("Ejemplo del recorrido de Amazon: identificador audifonos; modo Internacional; país CO; ciudad Bogotá; tienda Amazon; pedido 112-4455667-1234567. Use estos datos solo en la demostración. Para un pedido real, copie los datos de su compra.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("4. Revisar Cola de hoy")]]

#figure(box(width:100%,height:95mm,clip:true)[#image("img/01-cola-de-hoy.png",width: 100%)], caption: [#text[#text("Cola de hoy. Captura de la consola con datos sintéticos.")]])

#text[#text("Cada tarjeta corresponde a un producto. Muestra etapa, guía, transportadora y alertas. Arriba se resumen productos, productos que necesitan atención y productos al día. Pulse Actualizar para traer la información más reciente de la consola.")]

#text[#text("El recorrido visible al cliente se resume en Comprado → Alistamiento → Enviado → En camino → Entregado. En la consola puede ver nombres más precisos, como Pre-alertado o En bodega. Una entrega en una bodega internacional no significa que el cliente haya recibido el producto.")]

#text[#text("Haga clic en la guía para abrir la ficha. Allí se conservan los tramos, los eventos recibidos y el motivo de una retención. Compare la ciudad y el país del evento con el destino de la compra.")]

#figure(image("img/02-ficha-producto.png",width: 100%), caption: [#text[#text("Ficha del producto. Captura de la consola con datos sintéticos.")]])

#text[#text("No utilice Quitar con pedidos reales: elimina el producto y parte de su historial, sin papelera. Resérvelo para ejemplos descartables. Si registró mal un pedido real, comuníquelo a TI o al responsable antes de modificarlo. Corregir una guía mediante anulación conserva su registro; es distinto de quitar un producto.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("5. Atender alertas y retenciones")]]

#text[#text("Empiece por las tarjetas retenidas o con alerta. Abra la ficha, lea el motivo y confirme con la tienda, la transportadora o el responsable correspondiente. No anuncie Entregado por una sola señal dudosa.")]

#block(width: 100%,breakable:true)[#set text(size: 8.1pt)
#table(columns: (1fr, 1fr, 1fr),inset:5pt,stroke:0.4pt+rgb("D7E0E5"),table.header(table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Mensaje")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Qué significa")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Qué hacer"))),
[#text[#text("Retenido")]],
[#text[#text("El sistema recibió una novedad, pero no tiene pruebas suficientes para cambiar el estado")]],
[#text[#text("Lea el motivo y confirme los datos antes de avisar al cliente")]],
[#text[#text("Revisión")]],
[#text[#text("Hay datos que no coinciden, como fechas anteriores al registro")]],
[#text[#text("Compare la guía y el pedido con el correo original")]],
[#text[#text("Destino")]],
[#text[#text("La ciudad o país no coincide")]],
[#text[#text("Confirme la dirección con la transportadora y el cliente")]],
[#text[#text("Sin guía")]],
[#text[#text("La transportadora no reconoce el número")]],
[#text[#text("Compare el número con el aviso de despacho")]],
[#text[#text("Sin novedad")]],
[#text[#text("Se agotó el plazo sin movimiento")]],
[#text[#text("Pregunte a la tienda o transportadora y registre la gestión")]],
[#text[#text("Falta guía")]],
[#text[#text("Terminó un tramo y falta el siguiente")]],
[#text[#text("Pida la guía a la bodega o courier")]],
[#text[#text("Entrega parcial")]],
[#text[#text("Falta una o más cajas")]],
[#text[#text("Espere o confirme las cajas faltantes")]],
[#text[#text("Preguntar")]],
[#text[#text("Llegó la fecha de consultar el pedido")]],
[#text[#text("Contacte al responsable del envío")]],
)]

#text[#text("Ejemplo: el cliente está en Bogotá, pero el evento dice Entregado en Medellín. La decisión queda retenida. Verifique la dirección; no trate esa entrega como confirmación del cliente. Si después llega evidencia válida en Bogotá, el sistema vuelve a evaluar el estado.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("6. Revisar correos en Buzón")]]

#text[#text("TI configura la cuenta y prueba la conexión. Para su trabajo cotidiano:")]

+ #text[#text("Abra Buzón y compruebe que la vigilancia esté activa.")]
+ #text[#text("Para una lectura inmediata, pulse Leer ahora.")]
+ #text[#text("Revise la extracción terminada. Cada mensaje muestra Llegó, Lectura y Producto.")]
+ #text[#text("Compruebe que la tienda, el pedido y la guía corresponden a la compra correcta.")]

#text[#text("La vigilancia revisa el correo aproximadamente cada 45 segundos mientras el servidor esté encendido. Cada lectura tiene un límite de mensajes; si hay muchos correos atrasados, pida a TI que revise el periodo y la recuperación. Actualizar la página no obliga a una transportadora a producir una nueva novedad.")]

#figure(image("img/03-buzon-asociada.png",width: 100%), caption: [#text[#text("Correo asociado. Captura de la consola con datos sintéticos.")]])

#text[#text("Si aparece Ningún producto tiene ese pedido o sin producto, confirme primero que esa compra pertenece a la operación. Si es correcta:")]

+ #text[#text("Revise la tienda y el número de pedido leídos.")]
+ #text[#text("Escriba la ciudad real del cliente.")]
+ #text[#text("Elija Nacional o Internacional.")]
+ #text[#text("Pulse Vincular y compruebe el producto en Cola de hoy.")]

#figure(image("img/04-sin-producto.png",width: 100%), caption: [#text[#text("Correo sin producto. Captura de la consola con datos sintéticos.")]])

#block(width: 100%,breakable:true)[#set text(size: 8.1pt)
#table(columns: (1fr, 2fr),inset:5pt,stroke:0.4pt+rgb("D7E0E5"),table.header(table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Resultado")), table.cell(fill: rgb("EAF4F7"), text(weight: "bold", "Cómo actuar"))),
[#text[#text("Ya estaba")]],
[#text[#text("La guía ya existía; no debe volver a registrarla")]],
[#text[#text("Ignorado")]],
[#text[#text("Puede ser publicidad o un correo sin datos de despacho; revise si esperaba una guía")]],
[#text[#text("Sin guía")]],
[#text[#text("Espere el aviso que sí contenga la guía o pídala a la tienda")]],
[#text[#text("Formato desconocido")]],
[#text[#text("Avise a TI con un ejemplo del correo, ocultando datos personales innecesarios")]],
[#text[#text("Error de conexión")]],
[#text[#text("Avise a TI; no publique ni comparta contraseñas en capturas")]],
)]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("7. Seguimiento y modo de demostración")]]

#text[#text("El bloque de 17TRACK permite Consultar una guía y Traer registradas. TI debe indicar si la instalación usa ejemplos grabados o consulta real. Sin una llave de API, el modo predeterminado usa respuestas de prueba; una tarjeta de ejemplo no confirma un envío real.")]

#text[#text("En modo real, Consultar puede registrar una guía y consumir la cuota del servicio. Si la guía no existía en el módulo, puede crearse un producto auxiliar con valores de demostración; compruebe el destino, la tienda y la compra con TI antes de usarlo para informar al cliente. Traer registradas importa guías de la cuenta; no sustituye la conciliación de pedidos.")]

#text[#text("Cargar correos de ejemplo y las demostraciones deben usarse únicamente con la base de prueba indicada por TI. No ejecute las demostraciones sobre pedidos reales. Los botones de envío de aviso utilizan la cuenta configurada; coordine su uso para no confundir esos correos con despachos de la operación.")]

#heading(level: 3, numbering: none, outlined: false)[#text[#text("Cómo ayuda la inteligencia artificial")]]

#text[#text("Cuando TI habilita esta función, el sistema puede interpretar frases de un correo o de una novedad de transporte que las reglas no reconocen con claridad. Por ejemplo, una frase que describe que el cliente recibió el paquete puede ayudar a identificar una entrega.")]

#text[#text("Usted no necesita escribir instrucciones a la IA ni configurar una cuenta adicional. Revise siempre el estado y las razones de la ficha. Un correo que solo anuncia el despacho sigue siendo un despacho, y una entrega en otra ciudad necesita revisión. Si el servicio de IA no responde, el sistema conserva su lectura habitual por reglas.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("8. Ejercicio práctico sin correo real")]]

#text[#text("Pida a TI una instalación descartable en modo de ejemplos. Este ejercicio no necesita credenciales.")]

+ #text[#text("Registre el ejemplo de Amazon de la sección 3.")]
+ #text[#text("Abra Buzón y pulse Cargar correos de ejemplo.")]
+ #text[#text("Busque el mensaje Amazon del pedido 112-4455667-1234567.")]
+ #text[#text("Compruebe que aparece asociado a audifonos con la guía 1Z999AA10123456784.")]
+ #text[#text("Abra Cola de hoy y la ficha. El correo de despacho puede dejar la etapa Enviado; no equivale a una entrega al cliente.")]
+ #text[#text("Vuelva a cargar los ejemplos y confirme Ya estaba para esa guía.")]

#text[#text("Resultado esperado: una compra asociada a su guía y sin duplicado al repetir la lectura. Otros correos del ejercicio pueden quedar sin producto o sin guía; eso permite practicar la revisión de excepciones.")]

#heading(level: 2, numbering: none, outlined: false)[#text[#text("9. Dudas frecuentes y ayuda")]]

#text[#text("¿Tengo que consultar todas las transportadoras? Con las integraciones reales configuradas, revise principalmente las alertas. En una instalación de prueba los ejemplos no sustituyen la consulta real.")]

#text[#text("¿Por qué una guía puede cambiar? Un producto puede pasar por bodega, courier y última milla. Las guías pertenecen a tramos distintos y se deben conservar en la misma ficha.")]

#text[#text("¿Por qué no cambia el estado? Puede faltar evidencia, la entrega ser parcial, no coincidir el destino o no haber llegado una novedad real. Abra la ficha antes de pedir un cambio manual.")]

#text[#text("¿Se actualiza después de apagar el equipo? TI debe encender el servidor. Cuando una cuenta de buzón válida está guardada, el sistema vuelve a activar su vigilancia al arrancar. Compruebe su estado en Buzón.")]

#text[#text("¿Qué hago si registré mal una compra? Anote el identificador y el dato incorrecto y avise al responsable. No quite un pedido real para corregirlo sin un procedimiento de conservación.")]

#text[#text("¿Qué envío a soporte? La acción que estaba intentando, la hora aproximada, el identificador del producto, el mensaje de error y una captura sin contraseñas ni datos personales innecesarios. Utilice el canal de soporte acordado para la operación.")]

#text[#text("Antes de terminar su revisión diaria: atienda las tarjetas retenidas, compruebe que el buzón esté funcionando y deje registradas las gestiones pendientes. Las capturas de ejemplo explican el uso del sistema.")]

#text[#text("Fuente: consola, código y capturas del repositorio ")#link("https://github.com/EstebanForero/prototype-grabit")[#text("prototype-grabit")]#text(", base funcional ")#link("https://github.com/EstebanForero/prototype-grabit/tree/071fb8357351e7d38d23e29d142617cfe1c2d6f0")[#text("071fb83")]#text(". Las capturas son ejemplos de uso con datos sintéticos.")]