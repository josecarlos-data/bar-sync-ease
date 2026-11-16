# Revisión de los hallazgos de la auditoría externa

Todavía no se ha recibido ningún hallazgo. Este plan fija cómo se tratará cada uno cuando llegue. No se cambia nada en la app hasta que apruebes el plan de cada hallazgo.

## Para cada hallazgo
1. **Comprobación:** leer el código afectado y consultar la base de datos real (reglas de acceso, funciones, disparadores, permisos y datos), no solo los archivos de migración.
2. **Veredicto:** confirmado, parcialmente cierto o desmentido, con las pruebas que lo demuestran.
3. **Plan de arreglo (si procede):** qué se cambia, qué migración hace falta, qué puede romperse y cómo se probará (pruebas automáticas de la regla de dinero y una prueba real en el navegador).
4. **Alternativa:** si hay una solución más sencilla o mejor que la propuesta, se explica.

## Prioridad
Primero lo que afecta al dinero: totales, cobros, divisiones, fiado, tickets y facturas, y cuentas que no se pueden perder.

## Alcance
Solo se toca lo que entra en el hallazgo en revisión.

## Siguiente paso
Pega el primer hallazgo en el chat.
