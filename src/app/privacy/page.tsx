import React from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, Mail, FileText, BellRing, Lock } from 'lucide-react';

export const metadata = {
  title: 'Politique de Confidentialité - PHORGE',
  description: 'Politique de confidentialité et traitement des données de la plateforme PHORGE.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-3xl mx-auto">
        {/* Navigation */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-[#D4AF37] font-semibold transition-colors"
          >
            <ArrowLeft size={18} /> Retour à l'accueil
          </Link>
          <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-xl tracking-wider">
            PHORGE
          </div>
        </div>

        {/* Header Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 md:p-10 shadow-sm mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5 dark:opacity-10 text-[#D4AF37]">
            <Shield size={120} />
          </div>
          <div className="flex items-center gap-3 text-[#D4AF37] font-bold text-sm tracking-widest uppercase mb-3">
            <Shield size={16} /> RGPD & Sécurité
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-4">
            Politique de Confidentialité
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Dernière mise à jour : 15 août 2026. Cette politique décrit la manière dont PHORGE collecte, utilise et protège vos informations.
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Section 1 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
              <FileText className="text-[#D4AF37]" size={22} />
              1. Qui sommes-nous ?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm">
              La plateforme <strong>PHORGE</strong> est un outil de mise en relation professionnelle entre employeurs (patrons) et futurs apprentis, gérée dans le cadre académique de l'ECM Académie. Nous accordons une importance primordiale à la confidentialité de vos données et au respect du Règlement Général sur la Protection des Données (RGPD).
            </p>
          </div>

          {/* Section 2 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
              <Lock className="text-[#D4AF37]" size={22} />
              2. Quelles données collectons-nous ?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm mb-4">
              Pour assurer le bon fonctionnement de la plateforme et faciliter les mises en relation, nous collectons les données suivantes :
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-300 text-sm">
              <li><strong>Informations de profil</strong> : Nom, prénom, adresse e-mail, numéro de téléphone, rôle (apprenti ou patron).</li>
              <li><strong>Détails professionnels (Patrons)</strong> : Nom de l'entreprise, secteur d'activité, description et offres d'alternance.</li>
              <li><strong>Détails académiques (Apprentis)</strong> : Cursus d'études recherché, compétences, et photo de profil (facultative).</li>
              <li><strong>Messagerie interne</strong> : Contenu des messages échangés entre utilisateurs ayant validé un intérêt commun (match).</li>
              <li><strong>Notifications push</strong> : Informations techniques d'inscription de votre navigateur ou appareil mobile (endpoints de notification chiffrés).</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
              <BellRing className="text-[#D4AF37]" size={22} />
              3. Pourquoi utilisons-nous vos données ?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm mb-4">
              Le traitement de vos données personnelles repose sur l'exécution des fonctionnalités de mise en relation :
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-300 text-sm">
              <li>Mise en relation par système de "swipe" (consentement mutuel).</li>
              <li>Envoi de notifications push instantanées sur votre appareil (ordinateur ou mobile) lors d'un nouveau match, de la réception d'un message, d'une demande de période d'essai ou d'une déclaration de contrat.</li>
              <li>Administration de la plateforme et validation de la sécurité des profils par l'ECM Académie.</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
              <Shield className="text-[#D4AF37]" size={22} />
              4. Partage et hébergement des données
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm">
              Vos données sont hébergées en Europe de manière sécurisée par notre fournisseur de base de données **Supabase** (chiffrement au repos et en transit, et contrôles d'accès par politique de sécurité au niveau des lignes - RLS). Aucune donnée n'est revendue à des tiers ou utilisée à des fins publicitaires.
            </p>
          </div>

          {/* Section 5 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
              <FileText className="text-[#D4AF37]" size={22} />
              5. Vos droits (RGPD)
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm mb-4">
              Conformément à la réglementation européenne, vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-300 text-sm">
              <li><strong>Droit d'accès et de rectification</strong> : Vous pouvez consulter et modifier vos données directement depuis votre espace profil.</li>
              <li><strong>Droit à l'effacement</strong> : Vous pouvez demander la suppression complète de votre compte et de toutes vos données associées.</li>
              <li><strong>Droit de retrait du consentement pour les notifications</strong> : Vous pouvez désactiver à tout moment les alertes push directement dans les paramètres de votre navigateur ou dans l'onglet Profil de l'application.</li>
            </ul>
          </div>

          {/* Section 6 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-3">
              <Mail className="text-[#D4AF37]" size={22} />
              6. Contact
            </h2>
            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed text-sm mb-4">
              Pour toute question relative au traitement de vos données ou pour exercer vos droits, vous pouvez nous écrire à l'adresse suivante :
            </p>
            <a
              href="mailto:direction@ecm-academie.com"
              className="inline-flex items-center gap-2 text-[#D4AF37] hover:underline font-semibold text-sm"
            >
              <Mail size={16} /> direction@ecm-academie.com
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-zinc-400 text-xs">
          &copy; {new Date().getFullYear()} PHORGE - ECM Académie. Tous droits réservés.
        </div>
      </div>
    </div>
  );
}
