# Voz para las indicaciones de cocina

## Objetivo
En cocina (y barra), la indicación AI sigue mostrándose como texto y, además, se puede escuchar en voz alta.

## Lo que verá el usuario

1. **Botón de altavoz** junto a cada indicación en la tarjeta de la comanda: al pulsarlo, lee la indicación en voz alta (español). Si ya está sonando, la detiene.
2. **Reproducción automática**: cuando llega una indicación nueva a cocina/barra, suena sola (además del texto). Se puede desactivar.
3. **Ajustes del bar (admin)**, nueva sección "Voz de las indicaciones":
   - **Voz**: "Voz del dispositivo" (por defecto, gratis e instantánea) o "Voz IA" (más natural y consistente; se indica que consume créditos de IA y es más cara).
   - **Reproducción automática**: activada por defecto; si se desactiva, solo suena al pulsar el botón.
4. En la primera visita a cocina/barra, un aviso pide pulsar una vez para activar el sonido (los navegadores bloquean el audio automático hasta que el usuario toca la pantalla), reutilizando el patrón del botón "Activar avisos sonoros" del camarero.

## Cambios técnicos

- **Migración** en `bar_settings`: `kitchen_voice` text default `'device'` (check: `device`|`ai`) y `kitchen_voice_auto` boolean default `true`. Sin pérdida de datos.
- **Voz del dispositivo**: Web Speech API (`speechSynthesis`, voz `es-ES` si existe) en un hook `useSpeech` compartido; sin backend ni coste.
- **Voz IA**: nueva función de servidor `speakInstruction` (con `requireSupabaseAuth` y verificación de personal del bar) que llama a AI Gateway TTS con el modelo por defecto `google/gemini-3.1-flash-tts-preview` (formato Gemini, endpoint `/v1/audio/speech`) y devuelve el audio; el cliente lo reproduce con `Audio`. Manejo de errores según las reglas del gateway (402/403 → aviso claro, sin reintentos).
- **QueueBoard**: bloque de indicaciones con botón de altavoz por indicación; al llegar una indicación nueva (realtime ya suscrito a `order_instructions`), si `kitchen_voice_auto` está activo, la lee automáticamente con la voz configurada.
- **Ajustes (admin)**: selector de voz y toggle de reproducción automática.
- **Tipos**: actualizar `BarSettings` en `src/lib/types.ts`.

## Verificación
- Build OK y typecheck limpio.
- Prueba con Playwright: enviar una indicación desde camarero, ver el botón en cocina, pulsarlo y comprobar que se invoca la síntesis de voz; cambiar el ajuste a "Voz IA" y comprobar la llamada al gateway.
