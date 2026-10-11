-- ==============================================================================
-- SEED DATA PHORGE : 5 APPRENTIS & 5 PATRONS PAR SECTION (COIFFURE & ESTHÉTIQUE)
-- Total : 10 Apprenti·e·s + 10 Entreprises = 20 profils complets et validés
-- Mot de passe universel pour tous les comptes : Test1234!
-- ==============================================================================

-- 1. S'assurer que Row Level Security sur la table schools est désactivé et que CFA Alès existe
ALTER TABLE public.schools DISABLE ROW LEVEL SECURITY;
INSERT INTO public.schools (name) VALUES ('CFA Alès') ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
  v_school_id UUID;
  v_pass_hash TEXT;
  
  -- UUIDs fixes pour idempotence
  -- 5 Apprentis Coiffure
  app_coif_1 UUID := '11111111-aaaa-4000-8000-000000000001';
  app_coif_2 UUID := '11111111-aaaa-4000-8000-000000000002';
  app_coif_3 UUID := '11111111-aaaa-4000-8000-000000000003';
  app_coif_4 UUID := '11111111-aaaa-4000-8000-000000000004';
  app_coif_5 UUID := '11111111-aaaa-4000-8000-000000000005';

  -- 5 Apprentis Esthétique
  app_esth_1 UUID := '22222222-aaaa-4000-8000-000000000001';
  app_esth_2 UUID := '22222222-aaaa-4000-8000-000000000002';
  app_esth_3 UUID := '22222222-aaaa-4000-8000-000000000003';
  app_esth_4 UUID := '22222222-aaaa-4000-8000-000000000004';
  app_esth_5 UUID := '22222222-aaaa-4000-8000-000000000005';

  -- 5 Patrons Coiffure
  pat_coif_1 UUID := '33333333-bbbb-4000-8000-000000000001';
  pat_coif_2 UUID := '33333333-bbbb-4000-8000-000000000002';
  pat_coif_3 UUID := '33333333-bbbb-4000-8000-000000000003';
  pat_coif_4 UUID := '33333333-bbbb-4000-8000-000000000004';
  pat_coif_5 UUID := '33333333-bbbb-4000-8000-000000000005';

  -- 5 Patrons Esthétique
  pat_esth_1 UUID := '44444444-bbbb-4000-8000-000000000001';
  pat_esth_2 UUID := '44444444-bbbb-4000-8000-000000000002';
  pat_esth_3 UUID := '44444444-bbbb-4000-8000-000000000003';
  pat_esth_4 UUID := '44444444-bbbb-4000-8000-000000000004';
  pat_esth_5 UUID := '44444444-bbbb-4000-8000-000000000005';

BEGIN
  -- Nettoyage des éventuels comptes de vérification temporaires
  DELETE FROM auth.users WHERE email LIKE 'test_check%';

  SELECT id INTO v_school_id FROM public.schools WHERE name = 'CFA Alès' LIMIT 1;
  v_pass_hash := crypt('Test1234!', gen_salt('bf'));

  -- ==============================================================================
  -- 2. INSERTION DANS AUTH.USERS
  -- ==============================================================================

  -- Apprentis Coiffure
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES 
    (app_coif_1, 'authenticated', 'authenticated', 'lea.martin@test.phorge.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (app_coif_2, 'authenticated', 'authenticated', 'lucas.bernard@test.phorge.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (app_coif_3, 'authenticated', 'authenticated', 'emma.dubois@test.phorge.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (app_coif_4, 'authenticated', 'authenticated', 'enzo.rousseau@test.phorge.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (app_coif_5, 'authenticated', 'authenticated', 'chloe.petit@test.phorge.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Apprentis Esthétique
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES 
    (app_esth_1, 'authenticated', 'authenticated', 'sarah.fontaine@test.phorge.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (app_esth_2, 'authenticated', 'authenticated', 'ines.moreau@test.phorge.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (app_esth_3, 'authenticated', 'authenticated', 'camille.garcia@test.phorge.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (app_esth_4, 'authenticated', 'authenticated', 'manon.leroy@test.phorge.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (app_esth_5, 'authenticated', 'authenticated', 'jade.bonnet@test.phorge.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Patrons Coiffure
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES 
    (pat_coif_1, 'authenticated', 'authenticated', 'contact@latelier-alexandre.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (pat_coif_2, 'authenticated', 'authenticated', 'contact@maison-elegan.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (pat_coif_3, 'authenticated', 'authenticated', 'contact@barber-co-ales.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (pat_coif_4, 'authenticated', 'authenticated', 'contact@harmonie-coiffure.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (pat_coif_5, 'authenticated', 'authenticated', 'contact@studio-vegetal.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Patrons Esthétique
  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES 
    (pat_esth_1, 'authenticated', 'authenticated', 'contact@douceur-cevennes.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (pat_esth_2, 'authenticated', 'authenticated', 'contact@beauty-spa-ales.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (pat_esth_3, 'authenticated', 'authenticated', 'contact@lecrin-dor.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (pat_esth_4, 'authenticated', 'authenticated', 'contact@nails-glow.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW()),
    (pat_esth_5, 'authenticated', 'authenticated', 'contact@sens-harmonie.fr', v_pass_hash, NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ==============================================================================
  -- 3. INSERTION DANS PUBLIC.PROFILES (VALIDÉS)
  -- ==============================================================================

  -- Apprentis
  INSERT INTO public.profiles (id, email, role, school_id, is_approved, created_at)
  VALUES
    (app_coif_1, 'lea.martin@test.phorge.fr', 'apprenti', v_school_id, true, NOW()),
    (app_coif_2, 'lucas.bernard@test.phorge.fr', 'apprenti', v_school_id, true, NOW()),
    (app_coif_3, 'emma.dubois@test.phorge.fr', 'apprenti', v_school_id, true, NOW()),
    (app_coif_4, 'enzo.rousseau@test.phorge.fr', 'apprenti', v_school_id, true, NOW()),
    (app_coif_5, 'chloe.petit@test.phorge.fr', 'apprenti', v_school_id, true, NOW()),
    (app_esth_1, 'sarah.fontaine@test.phorge.fr', 'apprenti', v_school_id, true, NOW()),
    (app_esth_2, 'ines.moreau@test.phorge.fr', 'apprenti', v_school_id, true, NOW()),
    (app_esth_3, 'camille.garcia@test.phorge.fr', 'apprenti', v_school_id, true, NOW()),
    (app_esth_4, 'manon.leroy@test.phorge.fr', 'apprenti', v_school_id, true, NOW()),
    (app_esth_5, 'jade.bonnet@test.phorge.fr', 'apprenti', v_school_id, true, NOW())
  ON CONFLICT (id) DO UPDATE SET is_approved = true, school_id = v_school_id;

  -- Patrons
  INSERT INTO public.profiles (id, email, role, school_id, is_approved, created_at)
  VALUES
    (pat_coif_1, 'contact@latelier-alexandre.fr', 'patron', v_school_id, true, NOW()),
    (pat_coif_2, 'contact@maison-elegan.fr', 'patron', v_school_id, true, NOW()),
    (pat_coif_3, 'contact@barber-co-ales.fr', 'patron', v_school_id, true, NOW()),
    (pat_coif_4, 'contact@harmonie-coiffure.fr', 'patron', v_school_id, true, NOW()),
    (pat_coif_5, 'contact@studio-vegetal.fr', 'patron', v_school_id, true, NOW()),
    (pat_esth_1, 'contact@douceur-cevennes.fr', 'patron', v_school_id, true, NOW()),
    (pat_esth_2, 'contact@beauty-spa-ales.fr', 'patron', v_school_id, true, NOW()),
    (pat_esth_3, 'contact@lecrin-dor.fr', 'patron', v_school_id, true, NOW()),
    (pat_esth_4, 'contact@nails-glow.fr', 'patron', v_school_id, true, NOW()),
    (pat_esth_5, 'contact@sens-harmonie.fr', 'patron', v_school_id, true, NOW())
  ON CONFLICT (id) DO UPDATE SET is_approved = true, school_id = v_school_id;

  -- ==============================================================================
  -- 4. INSERTION DANS PUBLIC.APPRENTIS_DETAILS (10 APPRENTIS)
  -- ==============================================================================

  -- Coiffure 1
  INSERT INTO public.apprentis_details (
    profile_id, nom, prenom, domaine, specialites, bio, adresse, photo_profil, age, moyen_transport, stage_effectue, diplome_souhaite, diplome_acquis, motivation, latitude, longitude, distance_max
  ) VALUES (
    app_coif_1, 'Martin', 'Léa', 'coiffure',
    ARRAY['Balayage', 'Colorimétrie', 'Ombré hair'],
    'Passionnée par les nouvelles tendances de balayage et techniques de coupe moderne. Très souriante et motivée.',
    '12 Rue Saint-Vincent, 30100 Alès',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
    18, 'Permis B + Voiture', '2 stages en salon indépendant', 'Brevet Professionnel (BP)', 'CAP Coiffure',
    'Je souhaite intégrer un salon dynamique afin de perfectionner mes techniques de coloration et coiffage.',
    44.1272, 4.0833, 30
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Coiffure 2
  INSERT INTO public.apprentis_details (
    profile_id, nom, prenom, domaine, specialites, bio, adresse, photo_profil, age, moyen_transport, stage_effectue, diplome_souhaite, diplome_acquis, motivation, latitude, longitude, distance_max
  ) VALUES (
    app_coif_2, 'Bernard', 'Lucas', 'coiffure',
    ARRAY['Barbier', 'Dégradé américain', 'Coupe homme'],
    'Spécialisé dans les coupes masculines et le rasage à l''ancienne. Précis, rigoureux et ponctuel.',
    '45 Avenue Jean Jaurès, 30000 Nîmes',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
    19, 'Scooter', 'Stage 3 mois en Barbershop', 'Mention Complémentaire (MC)', 'CAP Coiffure',
    'Envie d''apporter mon dynamisme et mon savoir-faire dans un salon convivial et professionnel.',
    43.8367, 4.3601, 35
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Coiffure 3
  INSERT INTO public.apprentis_details (
    profile_id, nom, prenom, domaine, specialites, bio, adresse, photo_profil, age, moyen_transport, stage_effectue, diplome_souhaite, diplome_acquis, motivation, latitude, longitude, distance_max
  ) VALUES (
    app_coif_3, 'Dubois', 'Emma', 'coiffure',
    ARRAY['Coiffure événementielle', 'Chignons', 'Brushing'],
    'Créative et à l''écoute des clientes. J''adore les coiffures de mariée et les transformations capillaires.',
    '5 Chemin des Pins, 30380 Saint-Christol-lez-Alès',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500',
    17, 'Transports en commun', 'Stage découverte 4 semaines', 'CAP Coiffure 2ème année', 'Brevet des collèges',
    'Apprendre auprès d''une équipe bienveillante et me dépasser chaque jour au contact de la clientèle.',
    44.0847, 4.0772, 25
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Coiffure 4
  INSERT INTO public.apprentis_details (
    profile_id, nom, prenom, domaine, specialites, bio, adresse, photo_profil, age, moyen_transport, stage_effectue, diplome_souhaite, diplome_acquis, motivation, latitude, longitude, distance_max
  ) VALUES (
    app_coif_4, 'Rousseau', 'Enzo', 'coiffure',
    ARRAY['Lissage brésilien', 'Coupe ciseaux', 'Permanente moderne'],
    'Très motivé, doté d''un excellent relationnel. Curieux des innovations de soins et produits capillaires.',
    '8 Rue de la République, 30100 Alès',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500',
    20, 'Permis B', '1 an d''expérience en apprentissage', 'BP Coiffure', 'CAP Coiffure',
    'Mon objectif est de devenir autonome sur le plateau technique et de fidéliser une belle clientèle.',
    44.1245, 4.0812, 40
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Coiffure 5
  INSERT INTO public.apprentis_details (
    profile_id, nom, prenom, domaine, specialites, bio, adresse, photo_profil, age, moyen_transport, stage_effectue, diplome_souhaite, diplome_acquis, motivation, latitude, longitude, distance_max
  ) VALUES (
    app_coif_5, 'Petit', 'Chloé', 'coiffure',
    ARRAY['Coloration végétale', 'Patines', 'Soins botox'],
    'Sensibilité particulière pour les produits respectueux du cheveu et de l''environnement.',
    '14 Route d''Anduze, 30140 Bagard',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500',
    18, 'Voiture', 'Stage salon bio 6 semaines', 'CAP Coiffure', 'Bac Pro Métiers de la Beauté',
    'Rejoindre un salon qui partage mes valeurs éco-responsables et valorise la qualité du service.',
    44.0736, 4.0506, 30
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Esthétique 1
  INSERT INTO public.apprentis_details (
    profile_id, nom, prenom, domaine, specialites, bio, adresse, photo_profil, age, moyen_transport, stage_effectue, diplome_souhaite, diplome_acquis, motivation, latitude, longitude, distance_max
  ) VALUES (
    app_esth_1, 'Fontaine', 'Sarah', 'esthetique',
    ARRAY['Soin visage', 'Modelage relaxant', 'Épilation cire tiède'],
    'Douce, minutieuse et passionnée par l''univers du bien-être et des soins cabine relaxants.',
    '22 Rue d''Avéjan, 30100 Alès',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500',
    19, 'Permis B + Voiture', 'Stage en institut et spa thermal', 'Brevet Professionnel (BP)', 'CAP Esthétique',
    'M''investir dans un institut pour apporter calme, détente et conseils personnalisés aux client·e·s.',
    44.1258, 4.0845, 30
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Esthétique 2
  INSERT INTO public.apprentis_details (
    profile_id, nom, prenom, domaine, specialites, bio, adresse, photo_profil, age, moyen_transport, stage_effectue, diplome_souhaite, diplome_acquis, motivation, latitude, longitude, distance_max
  ) VALUES (
    app_esth_2, 'Moreau', 'Inès', 'esthetique',
    ARRAY['Prothésie ongulaire', 'Nail art', 'Vernis semi-permanent'],
    'Véritable artiste de l''onglerie. Perfectionniste, je maîtrise les capsules américaines et le gel.',
    '15 Boulevard Victor Hugo, 30000 Nîmes',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500',
    18, 'Bus / Train', 'Formation nail art + stages', 'Bac Pro Esthétique', 'CAP Esthétique',
    'Développer mon expertise en stylisme ongulaire au sein d''un institut branché et accueillant.',
    43.8345, 4.3582, 35
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Esthétique 3
  INSERT INTO public.apprentis_details (
    profile_id, nom, prenom, domaine, specialites, bio, adresse, photo_profil, age, moyen_transport, stage_effectue, diplome_souhaite, diplome_acquis, motivation, latitude, longitude, distance_max
  ) VALUES (
    app_esth_3, 'Garcia', 'Camille', 'esthetique',
    ARRAY['Maquillage professionnel', 'Rehaussement de cils', 'Teinture sourcils'],
    'Spécialiste du regard et du maquillage événementiel. Sens aigu du détail et de l''écoute.',
    '3 Place Henri Barbusse, 30100 Alès',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500',
    20, 'Permis B', 'Stages défilés & instituts', 'BTS Métiers de l''Esthétique', 'Bac Général',
    'Allier compétences techniques et conseils beauté haut de gamme dans une structure exigeante.',
    44.1281, 4.0805, 40
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Esthétique 4
  INSERT INTO public.apprentis_details (
    profile_id, nom, prenom, domaine, specialites, bio, adresse, photo_profil, age, moyen_transport, stage_effectue, diplome_souhaite, diplome_acquis, motivation, latitude, longitude, distance_max
  ) VALUES (
    app_esth_4, 'Leroy', 'Manon', 'esthetique',
    ARRAY['Hydrofacial', 'Soins anti-âge', 'Dermocosmétique'],
    'Attirée par les soins technologiques innovants et l''analyse de peau sur-mesure.',
    '9 Route de Saint-Jean, 30140 Anduze',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500',
    18, 'Voiture', 'Stage en centre de dermo-esthétique', 'CAP Esthétique 2ème année', 'Brevet des collèges',
    'Découvrir des protocoles de soins pointus et contribuer à la satisfaction quotidienne des clients.',
    44.0543, 3.9856, 35
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Esthétique 5
  INSERT INTO public.apprentis_details (
    profile_id, nom, prenom, domaine, specialites, bio, adresse, photo_profil, age, moyen_transport, stage_effectue, diplome_souhaite, diplome_acquis, motivation, latitude, longitude, distance_max
  ) VALUES (
    app_esth_5, 'Bonnet', 'Jade', 'esthetique',
    ARRAY['Massage californien', 'Gommage corps', 'Épilation au fil'],
    'Calme, bienveillante et très rigoureuse sur les règles d''hygiène et de confort cabine.',
    '31 Rue de la Meunière, 30100 Alès',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500',
    19, 'Trottinette électrique / Bus', '2 stages en institut traditionnel', 'BP Esthétique', 'CAP Esthétique',
    'Apporter toute ma douceur et ma rigueur dans un établissement centré sur le bien-être global.',
    44.1310, 4.0890, 20
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- ==============================================================================
  -- 5. INSERTION DANS PUBLIC.PATRONS_DETAILS (10 ENTREPRISES)
  -- ==============================================================================

  -- Patron Coiffure 1
  INSERT INTO public.patrons_details (
    profile_id, nom_entreprise, domaine, adresse, photo_profil, presentation, diplome_recherche, besoins, distance_max, latitude, longitude
  ) VALUES (
    pat_coif_1, 'L''Atelier d''Alexandre', 'coiffure',
    '18 Place Gabriel Péri, 30100 Alès',
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500',
    'Salon de coiffure urbain et chaleureux au cœur d''Alès. Nous formons avec passion des apprentis investis et désireux de maîtriser toutes les techniques actuelles.',
    'BP ou CAP 2ème année',
    ARRAY['Autonomie au bac', 'Accueil client souriant', 'Envie d''apprendre le balayage'],
    30, 44.1265, 4.0820
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Patron Coiffure 2
  INSERT INTO public.patrons_details (
    profile_id, nom_entreprise, domaine, adresse, photo_profil, presentation, diplome_recherche, besoins, distance_max, latitude, longitude
  ) VALUES (
    pat_coif_2, 'Maison Élégan''Cévennes', 'coiffure',
    '4 Boulevard Gambetta, 30100 Alès',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500',
    'Salon haut de gamme dédié à la coloration végétale et aux rituels de soins capillaires bio. Ambiance calme et soignée.',
    'Brevet Professionnel (BP)',
    ARRAY['Sens du détail', 'Appétence pour le végétal', 'Ponctualité exemplaire'],
    25, 44.1248, 4.0815
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Patron Coiffure 3
  INSERT INTO public.patrons_details (
    profile_id, nom_entreprise, domaine, adresse, photo_profil, presentation, diplome_recherche, besoins, distance_max, latitude, longitude
  ) VALUES (
    pat_coif_3, 'Barber & Co Alès', 'coiffure',
    '27 Rue d''Avéjan, 30100 Alès',
    'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=500',
    'Le rendez-vous incontournable des hommes à Alès. Espace barbier authentique avec fauteuils vintage et ambiance rock/vintage.',
    'Mention Complémentaire ou BP',
    ARRAY['Maîtrise de la tondeuse', 'Rasage traditionnel', 'Esprit d''équipe'],
    35, 44.1260, 4.0850
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Patron Coiffure 4
  INSERT INTO public.patrons_details (
    profile_id, nom_entreprise, domaine, adresse, photo_profil, presentation, diplome_recherche, besoins, distance_max, latitude, longitude
  ) VALUES (
    pat_coif_4, 'Harmonie Coiffure Studio', 'coiffure',
    '50 Rue de la République, 30000 Nîmes',
    'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=500',
    'Grand salon moderne avec une équipe de 6 coiffeurs. Forte dynamique, clientèle fidèle et opportunité d''embauche en CDI à la clé.',
    'Tous les diplômes',
    ARRAY['Dynamisme', 'Polyvalence', 'Esprit d''initiative'],
    40, 43.8375, 4.3620
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Patron Coiffure 5
  INSERT INTO public.patrons_details (
    profile_id, nom_entreprise, domaine, adresse, photo_profil, presentation, diplome_recherche, besoins, distance_max, latitude, longitude
  ) VALUES (
    pat_coif_5, 'Studio Végétal Coiffure', 'coiffure',
    '3 Route de Nîmes, 30560 Saint-Hilaire-de-Brethmas',
    'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=500',
    'Salon convivial et lumineux en périphérie d''Alès avec parking facile. Spécialiste des blonds sur-mesure et diagnostics personnalisés.',
    'CAP ou BP',
    ARRAY['Motivation', 'Aisance relationnelle', 'Sens artistique'],
    30, 44.0880, 4.1250
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Patron Esthétique 1
  INSERT INTO public.patrons_details (
    profile_id, nom_entreprise, domaine, adresse, photo_profil, presentation, diplome_recherche, besoins, distance_max, latitude, longitude
  ) VALUES (
    pat_esth_1, 'Institut Douceur des Cévennes', 'esthetique',
    '11 Rue Edgar Quinet, 30100 Alès',
    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=500',
    'Institut de beauté traditionnel réputé pour ses soins du visage d''exception et ses modelages relaxants. Cadre feutré et apaisant.',
    'Brevet Professionnel (BP)',
    ARRAY['Douceur', 'Rigueur hygiène', 'Conseil et vente de cosmétiques'],
    25, 44.1250, 4.0830
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Patron Esthétique 2
  INSERT INTO public.patrons_details (
    profile_id, nom_entreprise, domaine, adresse, photo_profil, presentation, diplome_recherche, besoins, distance_max, latitude, longitude
  ) VALUES (
    pat_esth_2, 'Beauty & Spa Alésien', 'esthetique',
    '8 Place de l''Hôtel de Ville, 30100 Alès',
    'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=500',
    'Espace spa urbain proposant hammam, soins duo et rituels du monde. Nous formons des apprenti·e·s passionné·e·s par le bien-être global.',
    'Bac Pro ou BTS Esthétique',
    ARRAY['Pratique des modelages', 'Gestion cabine', 'Sourire et discrétion'],
    30, 44.1275, 4.0825
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Patron Esthétique 3
  INSERT INTO public.patrons_details (
    profile_id, nom_entreprise, domaine, adresse, photo_profil, presentation, diplome_recherche, besoins, distance_max, latitude, longitude
  ) VALUES (
    pat_esth_3, 'L''Écrin d''Or Esthétique', 'esthetique',
    '25 Boulevard Amiral Courbet, 30000 Nîmes',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=500',
    'Centre esthétique spécialisé dans les technologies anti-âge, minceur et dermo-soins. Équipements de dernière génération.',
    'BP ou BTS',
    ARRAY['Appétence nouvelles technologies', 'Excellente présentation', 'Sens commercial'],
    40, 43.8390, 4.3640
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Patron Esthétique 4
  INSERT INTO public.patrons_details (
    profile_id, nom_entreprise, domaine, adresse, photo_profil, presentation, diplome_recherche, besoins, distance_max, latitude, longitude
  ) VALUES (
    pat_esth_4, 'Nails & Glow Lounge', 'esthetique',
    '14 Rue Rollin, 30100 Alès',
    'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=500',
    'Bar à ongles branché et studio du regard. Forte affluence, ambiance dynamique et jeune. Spécialistes du nail art et rehaussement.',
    'CAP ou Bac Pro',
    ARRAY['Rapidité d''exécution', 'Créativité nail art', 'Organisation du poste'],
    25, 44.1268, 4.0810
  ) ON CONFLICT (profile_id) DO NOTHING;

  -- Patron Esthétique 5
  INSERT INTO public.patrons_details (
    profile_id, nom_entreprise, domaine, adresse, photo_profil, presentation, diplome_recherche, besoins, distance_max, latitude, longitude
  ) VALUES (
    pat_esth_5, 'Sens & Harmonie Institut', 'esthetique',
    '45 Route de Bagnols, 30340 Saint-Privat-des-Vieux',
    'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=500',
    'Institut de beauté et bien-être aux portes d''Alès. Cadre verdoyant, cabines spacieuses et clientèle fidèle en quête de relaxation.',
    'Tous les diplômes',
    ARRAY['Ponctualité', 'Sens du contact humain', 'Précision des gestes'],
    30, 44.1450, 4.1200
  ) ON CONFLICT (profile_id) DO NOTHING;

END $$;
