-- «Hoy no hay» ya se venía mostrando en la carta, así que nace encendido
-- para no cambiarle la carta a nadie; el bar puede apagarlo desde Ajustes.
ALTER TABLE public.bar_settings ALTER COLUMN show_sold_out_notice SET DEFAULT true;
UPDATE public.bar_settings SET show_sold_out_notice = true WHERE show_sold_out_notice IS DISTINCT FROM true;
