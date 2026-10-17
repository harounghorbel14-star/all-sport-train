import type { Dictionary } from "./en";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

const fr: DeepPartial<Dictionary> = {
  app: { tagline: "Entraîne-toi mieux. Bouge mieux. Pour la vie." },
  nav: {
    today: "Aujourd'hui",
    coach: "Coach IA",
    plans: "Programmes",
    academy: "Académie",
    exercises: "Exercices",
    nutrition: "Nutrition",
    activity: "Activité",
    progress: "Progrès",
    recovery: "Récupération",
    formCheck: "Analyse technique",
    challenges: "Défis",
    community: "Communauté",
    sports: "Sports",
    profile: "Profil",
    more: "Plus",
    pricing: "Offres",
    logout: "Déconnexion",
    notifications: "Notifications",
  },
  common: { save: "Enregistrer", cancel: "Annuler", delete: "Supprimer", edit: "Modifier", add: "Ajouter", close: "Fermer", back: "Retour", next: "Suivant", skip: "Passer", done: "Terminé", start: "Commencer", loading: "Chargement…", retry: "Réessayer", search: "Rechercher", today: "Aujourd'hui" },
  auth: { login: "Connexion", register: "Créer un compte", email: "E-mail", password: "Mot de passe", welcomeBack: "Bon retour", startJourney: "Commence ton parcours" },
  today: { greeting: "Prêt, {name} ?", todaysSession: "Séance du jour", startWorkout: "Démarrer", resume: "Reprendre", restDay: "Jour de repos prévu", weekly: "Cette semaine", streak: "Série" },
  workout: { warmup: "Échauffement", main: "Travail principal", cooldown: "Retour au calme", sets: "Séries", reps: "Répétitions", rest: "Repos", pause: "Pause", resume: "Reprendre", finish: "Terminer" },
};
export default fr;
