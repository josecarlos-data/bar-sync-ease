# Pruebas de las últimas funciones

Pruebas automáticas en la vista previa, con pantalla de móvil y entrando como Camarero1 y Admin1. Se usan mesas y artículos de prueba; al terminar se cierran las cuentas abiertas.

## 1. Clientes de pie
- Abrir «De pie», crear una cuenta sin nombre (debe salir «Barra 1») y otra con nombre «Paco».
- Apuntar una caña con «Ya servido» y una tapa con «Enviar a preparar».
- Comprobar que la tapa aparece en Cocina como «Barra 2 · Paco» y no aparece en Mesas ni en QR.
- «Servir todo» y «Cobrar»: se cierra la cuenta, sale el ticket con IVA y la cuenta pasa al Histórico.

## 2. Apodo opcional y sin repeticiones
- Con «Pedir apodo» activado: escanear la mesa, entrar sin nombre → no se guarda «Mesa N».
- Con la opción desactivada: el QR entra directo a la carta.
- Revisar que en Cocina, Comandas y el texto que se lee en voz alta no se repite «Mesa 4, Mesa 4».
- Dejar el ajuste como estaba.

## 3. Modo bar pequeño
- Ajustes → «Bar pequeño»; añadir comanda en una mesa con «Lo más pedido».
- Comprobar la franja «Por preparar en cocina» con Listo/Servido y el botón «Servir todo (N)».
- Volver a «Equipo».

## 4. Cuenta dividida con consumo posterior
- Dividir una mesa en 2 grupos, pedir la cuenta, cobrar el Grupo A, añadir un café.
- Debe salir «Nuevo sin asignar», el «Cobrada» del Grupo B bloqueado y «Asignarlo yo» desbloquearlo; no se puede cerrar la mesa hasta cobrar todo.

## Resultado
- Informe con lo que funciona, capturas de lo importante y lista de fallos encontrados.
- Los fallos pequeños se corrigen en el momento; los grandes se proponen aparte.
