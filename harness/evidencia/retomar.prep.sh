# Trabajo a medias de una sesión anterior: el caso y su .json quedaron escritos, el parser no.
cp "$REPO/harness/casos-fuente/caso5-homecenter-guia.txt" harness/casos/
echo '{"store":"homecenter","storeOrderNumber":"771234","trackingNumber":"7012345678","carrier":"Coordinadora"}' > harness/casos/caso5-homecenter-guia.json
printf "\n- 2026-10-28 · caso5-homecenter-guia · EN CURSO: correo leído y .json escrito a mano (pasos 1-2 de la skill). Falta pasos 3-7. Sesión cortada.\n" >> harness/memoria/progreso.md
