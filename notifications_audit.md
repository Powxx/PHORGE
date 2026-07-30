# État des lieux du Module de Notifications (PHORGE)

Ce document présente l'audit technique du module de notifications de la plateforme PHORGE, détaillant son fonctionnement, ses capacités, ses limites et les pistes d'amélioration.

---

## 1. Fonctionnalités et Possibilités Actuelles (Forces)

Le système de notifications actuel repose sur une architecture hybride combinant **Supabase Realtime (WebSockets)**, les **Service Workers de PWA**, et l'**API Notification** standard du navigateur.

*   **Abonnements Temps Réel Ciblés** :
    *   **Nouveaux Messages** : Notifie l'utilisateur lorsqu'il reçoit un message dans une discussion active, sauf s'il est déjà en train de regarder cette discussion (vérification active de la visibilité et du chemin d'URL).
    *   **Nouveaux Matches** : Alerte immédiate lorsqu'une mise en relation est créée.
    *   **Périodes d'Essai & Contrats** : Notifications spécifiques pour les déclarations d'intention de contrat et les demandes d'essai destinées aux participants et aux administrateurs CFA.
    *   **Nouveaux Profils par Domaine** : Alerte les apprentis ou les patrons lorsqu'un profil du rôle opposé ayant le même domaine professionnel (ex. Coiffure) est inscrit et validé par un administrateur.
*   **Affichage Hybride Intelligent** :
    *   Tente d'abord d'utiliser le **Service Worker PWA** (`showNotification`) pour un affichage natif au niveau de l'OS (même si le navigateur est réduit).
    *   Bascule sur un affichage classique `new Notification()` dans le cas où le Service Worker n'est pas encore opérationnel.
*   **Redirection Intégrée** : Le clic sur la notification ouvre/active l'application et redirige instantanément l'utilisateur vers le bon salon de chat (`/chat/[matchId]`) ou l'écran découverte (`/swipe`).
*   **Indicateurs Visuels Réactifs** : Synchronisation visuelle immédiate des points de notification dorés dans le menu de navigation et la liste des discussions dès que l'état de lecture (`is_read`) change dans la base de données.

---

## 2. Limites et Faiblesses Techniques (Limitations)

Bien que le module soit réactif, il présente des limitations inhérentes aux technologies Web de premier niveau :

1.  **Dépendance à la Connexion Active (WebSocket)** :
    *   *Problème* : L'écoute des événements se fait côté client (dans le navigateur) via le canal Realtime de Supabase.
    *   *Conséquence* : Si l'onglet est fermé, ou si le système d'exploitation du téléphone met en veille le navigateur pour économiser de la batterie, la connexion WebSocket est coupée. **Aucune notification ne sera reçue si l'application est complètement fermée**.
2.  **Manque de Système "Web Push" natif (Server-to-Client)** :
    *   Les notifications push mobiles standards (comme sur WhatsApp ou Instagram) nécessitent un serveur tiers qui envoie une charge utile via des services de messagerie cloud (FCM pour Google, APNs pour Apple). Actuellement, PHORGE ne stocke pas de jetons d'abonnement (PushSubscription JSON) en base de données et n'utilise pas de clés VAPID pour réveiller le Service Worker à distance.
3.  **Restrictions iOS / Safari** :
    *   Sur iOS (iPhone/iPad), les notifications PWA ne fonctionnent **que** si l'utilisateur a explicitement ajouté l'application à son écran d'accueil ("Sur l'écran d'accueil") et l'exécute en mode autonome (Standalone). Elles ne fonctionnent pas directement depuis l'application Safari classique ou des WebViews tierces (comme Chrome sur iOS).
4.  **Action requise pour l'autorisation** :
    *   Les navigateurs modernes interdisent de demander l'autorisation de notification automatiquement sans interaction utilisateur. Si l'utilisateur clique sur "Bloquer", il est impossible de lui redemander via l'application. La seule solution est de le guider pour qu'il modifie manuellement les paramètres de son navigateur (géré via notre nouveau bouton sur la page Profil).

---

## 3. Recommandations pour le Futur (Feuille de Route)

Pour transformer ce système en notifications "Push" professionnelles et infaillibles, voici les étapes recommandées :

*   **Étape 1 : Enregistrement des abonnements de push (Push Subscription)** :
    *   Créer une table `user_push_subscriptions` dans la base de données avec les colonnes `user_id`, `subscription_data` (JSON).
    *   À l'activation des notifications par l'utilisateur, utiliser `navigator.serviceWorker.ready.then(reg => reg.pushManager.subscribe(...))` avec des clés VAPID publiques pour obtenir l'objet d'abonnement et l'enregistrer dans cette table.
*   **Étape 2 : Déclenchement serveur (Supabase Edge Functions / Next.js API)** :
    *   Écrire un trigger de base de données PostgreSQL ou utiliser un webhook qui appelle une fonction d'API lorsqu'un nouveau message ou match est inséré.
    *   Cette fonction serveur utilisera la bibliothèque `web-push` pour envoyer la notification directement aux terminaux enregistrés dans `user_push_subscriptions`.
    *   *Avantage* : Fonctionne même si l'application est fermée et que le téléphone est verrouillé, en réveillant le Service Worker en arrière-plan.
