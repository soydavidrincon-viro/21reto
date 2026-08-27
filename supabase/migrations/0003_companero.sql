-- El compañero que elige cada persona en el onboarding.
--
-- Va en profiles y no en habits: es de la persona, no del hábito. Quien lleva
-- tres retos a la vez no quiere tres mascotas distintas mirándolo.

alter table public.profiles
  add column if not exists companion text not null default 'brote'
    check (companion in ('roco', 'chispa', 'brote', 'nube'));

comment on column public.profiles.companion is
  'Personaje que acompaña en la pantalla Hoy. Brote por defecto: es el que se
   presenta como "para quien va empezando".';
