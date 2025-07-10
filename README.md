# Service de Paiement

Ce service gère les paiements via Stripe et met à jour automatiquement les utilisateurs en premium après un paiement réussi.

## Configuration

1. Copiez le fichier `.env_exemple` vers `.env` et configurez vos variables d'environnement :

```bash
cp .env_exemple .env
```

2. Configurez vos clés Stripe dans le fichier `.env` :

   - `STRIPE_SECRET_KEY` : Votre clé secrète Stripe
   - `STRIPE_PUBLISHABLE_KEY` : Votre clé publique Stripe
   - `STRIPE_WEBHOOK_SECRET` : Le secret de votre webhook Stripe

3. Configurez l'URL du service d'authentification :
   - `AUTH_SERVICE_URL` : URL de votre service d'authentification

## Installation

```bash
npm install
```

## Démarrage

```bash
# Développement
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### Créer un paiement

```
POST /api/payments/create
```

Body :

```json
{
  "amount": 29.99,
  "currency": "eur",
  "userId": "user_id_here",
  "description": "Abonnement Premium"
}
```

### Vérifier le statut d'un paiement

```
GET /api/payments/status/:paymentIntentId
```

### Webhook Stripe

```
POST /api/payments/webhook
```

## Configuration Stripe

1. Créez un compte Stripe et récupérez vos clés API
2. Configurez un webhook dans votre dashboard Stripe :
   - URL : `https://votre-domaine.com/api/payments/webhook`
   - Événements : `payment_intent.succeeded`, `payment_intent.payment_failed`

## Flux de paiement

1. L'application frontend appelle `/api/payments/create` avec les détails du paiement
2. Le service crée un PaymentIntent Stripe et retourne le client_secret
3. Le frontend utilise le client_secret pour finaliser le paiement
4. Stripe envoie un webhook au service quand le paiement est réussi
5. Le service met à jour l'utilisateur en premium via l'API d'authentification

## Intégration avec le service d'authentification

Le service d'authentification doit exposer un endpoint pour mettre à jour un utilisateur en premium :

```
PUT /api/users/:userId/premium
```

Headers :

```
Authorization: Bearer <token>
Content-Type: application/json
```

## Variables d'environnement

- `MONGODB_USER` : Utilisateur MongoDB
- `MONGODB_PASSWORD` : Mot de passe MongoDB
- `MONGODB_CLUSTER` : Cluster MongoDB
- `PORT` : Port du service (défaut: 3001)
- `STRIPE_SECRET_KEY` : Clé secrète Stripe
- `STRIPE_PUBLISHABLE_KEY` : Clé publique Stripe
- `STRIPE_WEBHOOK_SECRET` : Secret du webhook Stripe
- `AUTH_SERVICE_URL` : URL du service d'authentification
