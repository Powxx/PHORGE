-- 1. Désactive Row Level Security sur la table schools pour que tout utilisateur (connecté ou en cours d'inscription) puisse voir la liste des écoles
ALTER TABLE public.schools DISABLE ROW LEVEL SECURITY;

-- 2. S'assure que 'CFA Alès' est bien inséré en base de données
INSERT INTO public.schools (name) VALUES ('CFA Alès') ON CONFLICT (name) DO NOTHING;

-- 3. Attribue l'école 'CFA Alès' à tous les profils existants qui n'ont pas encore d'école rattachée
UPDATE public.profiles 
SET school_id = (SELECT id FROM public.schools WHERE name = 'CFA Alès' LIMIT 1)
WHERE school_id IS NULL;
