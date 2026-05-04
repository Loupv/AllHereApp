# TestFlight Beta App Review — Préremplissage

À remplir dans App Store Connect → AllHere (Silent Mind) → TestFlight et App Information.
Champs marqués **[CHOIX]** : à arbitrer par toi.

---

## 1. App Privacy (App Information → App Privacy)

### Data collected

| Data type | Collected? | Linked to user? | Used for tracking? | Purposes |
|-----------|------------|-----------------|--------------------|---------| 
| Email Address | Yes (via Sign in with Apple / Google) | Yes | No | App Functionality, Account |
| Name | Yes (via OAuth) | Yes | No | App Functionality |
| User ID | Yes (OAuth subject) | Yes | No | App Functionality |
| Audio Data | No | — | — | — |
| Crash Data | **[CHOIX]** Yes if you keep Sentry/expo-error-reporting | Yes/No | No | App Functionality |
| Performance Data | **[CHOIX]** | — | No | — |

**Note** : Si tu n'utilises pas d'analytics (Amplitude, GA, Firebase, etc.) — déclare juste les données OAuth (email, name, userId) et rien d'autre.

### Privacy choices

- "Do you or your third-party partners use data for tracking purposes?" → **No**
- "Do you collect data from this app?" → **Yes** (à cause d'OAuth)

---

## 2. Privacy Policy URL

**Obligatoire dès qu'on collecte la moindre donnée.** Options :

- (a) Hébergée sur allhere.org : `https://allhere.org/privacy` ou `/privacy-policy` — **[CHOIX]** vérifie qu'une page existe ou crée-la
- (b) Page WordPress dédiée à l'app : `https://allhere.org/silent-mind-privacy`

Contenu minimal à inclure :
- Quelles données : email, nom, identifiant Apple/Google
- Pourquoi : authentification, sauvegarde de la progression
- Stockage : Supabase (ou ton backend) + AsyncStorage local
- Pas de partage tiers, pas de tracking publicitaire
- Suppression compte : email à `loup.vuarnesson@allhere.org`
- Droits RGPD (si tu vises l'UE)

---

## 3. App Information

| Champ | Valeur préremplie |
|-------|-------------------|
| Name | AllHere — Silent Mind |
| Subtitle | Quantified Meditation Training |
| Bundle ID | org.allhere.silentmind |
| SKU | allhere-silentmind-001 |
| Primary Language | English (U.S.) |
| Privacy Policy URL | `https://allhere.org/privacy` **[CHOIX URL exacte]** |
| Category — Primary | Health & Fitness |
| Category — Secondary | Education |
| Content Rights | Does NOT contain third-party content (à confirmer si tous les audios sont créés par All Here) |
| Age Rating | 4+ (méditation, pas de contenu sensible) |

---

## 4. TestFlight → Test Information

### Beta App Description (jusqu'à 4000 chars)

> AllHere is a meditation training app combining traditional silent practice with Quantified Meditation™ — a structured format of short timed rounds with guided breaks. Users can listen to a 1-minute or 3-minute meditation to start, follow the multi-part Silent Mind program, or run timed QM3 / QM5 sessions for sustained attention training.
>
> This beta tests the full audio experience: streaming + offline caching of the program audios, the Quantified Meditation player with rounds and inter-round transitions, synchronized transcripts, and the practice progression tracking.

### Feedback Email

`loup.vuarnesson@allhere.org`

### Marketing URL (optionnel)

`https://allhere.org`

### Privacy Policy URL (obligatoire)

`https://allhere.org/privacy` **[CHOIX]**

### Sign-In Required?

**[CHOIX]** :
- Si l'utilisateur peut "Skip for now" → **No** (mais flagger qu'un compte test est dispo)
- Sinon **Yes** + créer un compte test :
  - Username/Email: `testflight-reviewer@allhere.org`
  - Password: `[à générer]`
  - Notes: "Or use 'Skip for now' on the auth screen — most features are accessible without authentication."

### What to Test (notes au reviewer Apple — à chaque submission)

```
What's new in this build:
- New bundle ID (org.allhere.silentmind) — fresh App Store Connect entry
- Hybrid audio architecture: ~50MB bundled (Home tier + QM3 first 3 rounds), 
  rest streamed from our CDN with offline caching
- Quantified Meditation player rewrite: rounds + inters + synchronized transcripts
- Sub-page navigation polish (back gesture, swipe-to-next-tab)

How to test the core flow:
1. Skip the auth screen ("Skip for now") to enter the app
2. Tap "1 minute" on the Start screen — should play instantly (bundled)
3. Tap "3min × 3" — Quantified Meditation session, 3 rounds with 1-min breaks
4. Go to "Silent Mind" tab → Part 1 → tap any audio — streams from server, 
   caches locally on first play
5. Go to "QM Training" tab → Part 1 → "QM3 — Breath and Self-Observation" 
   for the full 7-round session

Known limitations:
- External tester reviews still need Beta Review approval; this build was 
  also internally tested.
```

---

## 5. Age Rating Questionnaire

Réponds **None** à toutes les questions sauf :
- **Unrestricted Web Access** → **No** (l'app n'a pas de WebView ouverte)
- **Gambling and Contests** → **No**
- **Mature/Suggestive Themes** → **No**

Résultat attendu : **4+**

---

## 6. Export Compliance

Déjà géré dans `app.json` :

```json
"ios": {
  "infoPlist": {
    "ITSAppUsesNonExemptEncryption": false
  }
}
```

→ Aucune action manuelle requise dans App Store Connect.

---

## 7. Avant submission Beta Review — Checklist

- [ ] Privacy Policy URL en ligne et accessible
- [ ] App Privacy questionnaire complété
- [ ] Age Rating questionnaire complété
- [ ] Test Information rempli (description, feedback email, what to test)
- [ ] (Optionnel) Compte de test créé si Sign-In Required = Yes
- [ ] Build uploaded via Transporter, visible dans TestFlight (statut "Ready to Submit")
- [ ] Submit for Beta App Review

Délai Apple : **24-48h** habituellement. Si refus → email avec raison, corrige et resoumets.

---

## 8. Internal Testing (sans review)

Tu peux ajouter jusqu'à **100 testeurs internes** (membres de ton compte App Store Connect avec rôle Developer / App Manager) sans aucune review. Une fois le build apparu dans TestFlight, va dans Internal Testing → ajoute le groupe → ils reçoivent un email pour installer immédiatement.

C'est ce que je te recommande pour les premiers tests pendant que la Beta Review tourne.
