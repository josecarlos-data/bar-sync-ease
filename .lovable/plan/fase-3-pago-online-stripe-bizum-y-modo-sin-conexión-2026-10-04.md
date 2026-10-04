# Fase 3: pago online (Stripe + Bizum) y modo sin conexión

Todo opcional y configurable desde Ajustes, apagado por defecto. Se reutiliza lo que ya existe: el indicador «En línea / Sin conexión», el ajuste `offline_mode`, el registro manual de Bizum y el flag `payments_enabled`.

## Parte 1 — Pago online

### Stripe con tarjeta
1. Activar los pagos integrados de Lovable con Stripe (entorno de pruebas primero; para cobrar de verdad hace falta verificar la cuenta). Requiere plan Pro.
2. Flujo para el cliente:
   - Al pedir la cuenta (mesa entera o una parte de la cuenta dividida), si el bar tiene el pago online activado, aparece el botón «Pagar con tarjeta».
   - Se crea una sesión de pago por el importe exacto de esa parte; el cliente paga desde su móvil.
   - Al confirmarse el pago (webhook), la parte queda marcada como pagada con método «tarjeta», se emite su ticket/factura como al cobrar en mano y el camarero lo ve en tiempo real.
3. Webhook en `/api/public/stripe-webhook` con verificación de firma; es quien marca la parte como pagada (nunca el navegador del cliente).
4. Bizum se mantiene como alternativa manual: el cliente ve el número y el importe de su parte, paga por Bizum y el camarero confirma el cobro. Ambos métodos conviven y se activan por separado en Ajustes.

### Ajustes nuevos
- «Pago online con tarjeta» (activar/desactivar, usa el `payments_enabled` existente).
- Texto opcional que ve el cliente junto al botón de pago.

## Parte 2 — Modo sin conexión (personal)

Activable con el ajuste «Modo sin conexión» ya existente. Pensado para bares con mala cobertura: el aparato del camarero guarda lo esencial y sincroniza al volver la red.

1. **Consultar y cobrar mesas sin red**
   - Mientras hay conexión, el aparato guarda en local las mesas abiertas con sus comandas y totales.
   - Sin red, Mesas y De pie muestran esos datos con la etiqueta «Guardado a las HH:MM».
   - Se puede marcar un cobro sin red: queda registrado en el aparato como «pendiente de sincronizar» y se confirma en la base de datos al volver la conexión.

2. **Crear comandas sin red**
   - «Añadir comanda» funciona sin red usando la carta guardada en el aparato.
   - Las comandas se guardan en una cola local y se envían solas al volver la red, en su orden original. Si algo falla (mesa cerrada mientras tanto), se avisa al camarero en vez de perder la comanda.

3. **Colas de cocina y barra sin red**
   - Cocina y Barra guardan las comandas pendientes y pueden marcar «en preparación / listo / servido» sin red; los cambios se sincronizan al volver.

4. **Indicador de conexión mejorado**
   - El indicador actual pasa a mostrar también «Sincronizando…» y «3 cambios pendientes» cuando hay cosas en cola.

### Límites honestos del modo offline
- Solo funciona en aparatos que hayan abierto la app con conexión antes (la carta y las mesas se guardan en ese momento).
- Si dos aparatos cambian lo mismo sin red, manda el último cambio al sincronizar; los cobros nunca se duplican porque se confirman contra la base de datos.
- El cliente que escanea el QR sigue necesitando cobertura propia; el modo offline es para el personal.

## Detalles técnicos
- Stripe: `enable_stripe_payments`, sesión de checkout por parte de `bill_split_parts` o por sesión completa; webhook con verificación de firma en `src/routes/api/public/`; al confirmar, marcar `payment_method='tarjeta'`, `paid_at` y emitir factura con la numeración existente.
- Offline: almacenamiento local del navegador (sin librerías nuevas pesadas); cola de operaciones con reintentos; estado de sincronización en `ConnectionBadge`.
- Sin cambios en lo ya probado: fiado, espera, idiomas, tapas e impresoras quedan como están.

## Verificación
- Pago de prueba con tarjeta de test de Stripe en una cuenta dividida: pagar una parte online y otra en mano.
- Modo avión en el móvil: consultar mesa, cobrar, crear comanda, marcar listo en cocina; quitar modo avión y comprobar que todo se sincroniza.
