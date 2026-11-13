import type { TemplateType } from "@workspace/api-zod";

/**
 * Modèles de démonstration fournis avec le POC.
 * Ce sont des trames rédactionnelles génériques à adapter et à faire
 * valider par un avocat : elles ne constituent pas des actes validés.
 */
export const SYSTEM_TEMPLATES: { name: string; type: TemplateType; description: string; body: string }[] = [
  {
    name: "Requête introductive d'instance",
    type: "requete_introductive",
    description: "Saisine d'une juridiction au fond : parties, faits, moyens et demandes.",
    body: `> {{cabinet.ville}}, le {{date.jour}}

> À Monsieur le Président du {{juridiction}}

# Requête introductive d'instance

## Pour
{{client.nom}}, demeurant ou ayant son siège à {{client.adresse}}, agissant en qualité de {{client.qualite}}, ayant pour conseil {{avocat.nom}}, {{avocat.titre}}, en l'étude duquel domicile est élu.

## Contre
{{partie_adverse.nom}}, ayant pour conseil {{partie_adverse.conseil}}.

## Objet
{{objet}}

## Exposé des faits
{{faits}}

## Discussion
{{moyens}}

^ PAR CES MOTIFS

Il est demandé au Tribunal de bien vouloir :
- Déclarer la présente requête recevable et bien fondée ;
- {{demandes}}
- Condamner la partie défenderesse aux entiers dépens.

> Sous toutes réserves.
> Pour {{client.nom}}, {{avocat.nom}}

## Pièces
Voir le bordereau de communication de pièces annexé (réf. {{dossier.reference}}).`,
  },
  {
    name: "Requête en référé",
    type: "refere",
    description: "Demande de mesures urgentes devant le juge des référés.",
    body: `> {{cabinet.ville}}, le {{date.jour}}

> À Monsieur le Président du {{juridiction}}, statuant en matière de référé

# Requête aux fins d'assignation en référé

## Pour
{{client.nom}}, {{client.adresse}}, ayant pour conseil {{avocat.nom}}, {{avocat.titre}}.

## Contre
{{partie_adverse.nom}}.

## Sur l'urgence
{{urgence}}

## Sur l'absence de contestation sérieuse
{{moyens}}

^ PAR CES MOTIFS

Le requérant sollicite qu'il plaise à Monsieur le Président :
- L'autoriser à assigner {{partie_adverse.nom}} à bref délai, à l'audience du {{date_audience}} ;
- Ordonner {{mesure_demandee}} ;
- Ordonner l'exécution provisoire de la décision à intervenir, sur minute et avant enregistrement.

> Sous toutes réserves.
> {{avocat.nom}}`,
  },
  {
    name: "Demande de renvoi",
    type: "renvoi",
    description: "Lettre sollicitant le renvoi d'une affaire à une audience ultérieure.",
    body: `> {{cabinet.ville}}, le {{date.jour}}

> Monsieur le Président
> {{juridiction}}

^ Objet : demande de renvoi — {{dossier.intitule}}
^ N° de rôle : {{dossier.numero_role}} — audience du {{date_audience}}

Monsieur le Président,

J'ai l'honneur de solliciter respectueusement le renvoi de l'affaire citée en référence, appelée à votre audience du {{date_audience}}, dans laquelle j'assiste {{client.nom}}, {{client.qualite}}.

Ce renvoi est sollicité pour le motif suivant : {{motif_renvoi}}

Mon confrère {{partie_adverse.conseil}}, conseil de {{partie_adverse.nom}}, a été informé de la présente demande.

Je vous prie d'agréer, Monsieur le Président, l'expression de ma très haute considération.

> {{avocat.nom}}
> {{avocat.titre}}`,
  },
  {
    name: "Lettre à une juridiction",
    type: "lettre_juridiction",
    description: "Courrier au greffe ou au président d'une juridiction (communication, information).",
    body: `> {{cabinet.ville}}, le {{date.jour}}

> Monsieur le Greffier en chef
> {{juridiction}}

^ Objet : {{objet}}
^ Affaire : {{dossier.intitule}} — Réf. cabinet {{dossier.reference}}

Monsieur le Greffier en chef,

{{corps_du_courrier}}

Je vous remercie par avance de la suite que vous voudrez bien réserver à la présente et vous prie d'agréer l'expression de mes salutations distinguées.

> {{avocat.nom}}`,
  },
  {
    name: "Mise en demeure",
    type: "mise_en_demeure",
    description: "Mise en demeure de payer ou d'exécuter une obligation avant toute action.",
    body: `> {{cabinet.ville}}, le {{date.jour}}

> {{partie_adverse.nom}}

^ LETTRE RECOMMANDÉE AVEC ACCUSÉ DE RÉCEPTION
^ Objet : mise en demeure

Madame, Monsieur,

J'interviens en qualité de conseil de {{client.nom}}, qui m'a chargé de la défense de ses intérêts dans le différend qui vous oppose.

{{rappel_des_faits}}

En conséquence, je vous mets en demeure de {{obligation}} dans un délai de {{delai}} à compter de la réception de la présente.

À défaut, mon client se réserve le droit d'engager toute procédure utile devant la juridiction compétente, sans autre avis, les frais de procédure restant à votre charge.

Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

> {{avocat.nom}}
> {{avocat.titre}}`,
  },
  {
    name: "Courrier administratif",
    type: "courrier_administratif",
    description: "Courrier à une administration (demande de pièces, recours gracieux…).",
    body: `> {{cabinet.ville}}, le {{date.jour}}

> {{destinataire}}

^ Objet : {{objet}}
^ Pour le compte de : {{client.nom}}

Madame, Monsieur,

Agissant au nom et pour le compte de {{client.nom}}, j'ai l'honneur de {{demande}}

Je reste à votre disposition pour toute information complémentaire et vous prie d'agréer l'expression de ma considération distinguée.

> {{avocat.nom}}`,
  },
];
