# Caso imposible a propósito: mismo correo que fixtures/correos/alibaba.txt, pero el .json espera otra transportadora.
cp fixtures/correos/alibaba.txt harness/casos/caso-conflicto.txt
echo '{"store":"alibaba","storeOrderNumber":"123456789012345","trackingNumber":"ALB9988776655","carrier":"DHL"}' > harness/casos/caso-conflicto.json
