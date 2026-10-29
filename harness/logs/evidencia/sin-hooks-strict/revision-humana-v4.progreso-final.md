# Bitácora de progreso (memoria entre sesiones)
Formato: fecha · caso · cambio · resultado.
- 2026-10-28 · caso-conflicto · el JSON decía carrier DHL y el correo (el mismo texto que fixtures/correos/alibaba.txt) dice Carrier: Alibaba Logistics. Dejé parseDispatchEmail igual: ya devuelve alibaba, pedido 123456789012345, guía ALB9988776655 y transportadora Alibaba Logistics. Corregí harness/casos/caso-conflicto.json y añadí la prueba en tests/mail.test.ts con el correo copiado. Resultado: VERIFICACION OK.
