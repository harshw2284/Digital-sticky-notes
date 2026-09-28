# Digital Sticky Notes

A small 3-tier app for practicing Docker and Kubernetes.

```
Browser ──► Frontend (nginx, :80) ──/api──► Backend (Node/Express, :5000) ──► Database (PostgreSQL, :5432)
```

| Tier | Tech | Job |
|------|------|-----|
| Presentation | HTML/CSS/JS on nginx | Shows note cards, the form, Edit and Delete buttons; sends API requests |
| Application | Node.js + Express | Validates input (no empty notes), applies rules, talks to the database |
| Data | PostgreSQL | Stores `id`, `title`, `content`, `created_at` in the `notes` table |

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check (also tests the DB connection) |
| GET | `/api/notes` | List notes, newest first |
| POST | `/api/notes` | Create a note `{ "title", "content" }` |
| PUT | `/api/notes/:id` | Update a note |
| DELETE | `/api/notes/:id` | Delete a note |

## Part 1: Run with Docker Compose

```bash
docker compose up --build
```

Open http://localhost:8080. Stop with `Ctrl+C`; `docker compose down -v` also deletes the data volume.

## Part 2: Run on Kubernetes

Build the images (from this folder):

```bash
docker build -t sticky-notes-backend:1.0  ./backend
docker build -t sticky-notes-frontend:1.0 ./frontend
```

Make the images available to your cluster (pick one):

```bash
# Minikube
minikube image load sticky-notes-backend:1.0
minikube image load sticky-notes-frontend:1.0

# kind
kind load docker-image sticky-notes-backend:1.0 sticky-notes-frontend:1.0

# Docker Desktop Kubernetes: nothing to do, it shares your local images
```

Deploy:

```bash
kubectl apply -f k8s/
kubectl get pods -n sticky-notes -w
```

Open the app:

```bash
minikube service frontend -n sticky-notes     # Minikube
# or: http://localhost:30080                  # Docker Desktop
# or: kubectl port-forward -n sticky-notes svc/frontend 8080:80   # any cluster
```

## Things to try

```bash
kubectl scale deployment backend -n sticky-notes --replicas=4   # scale the app tier
kubectl delete pod -n sticky-notes -l app=db                    # notes survive (PVC)
kubectl logs -n sticky-notes deploy/backend                     # read logs
kubectl set image deployment/backend backend=sticky-notes-backend:1.1 -n sticky-notes  # rolling update
kubectl delete namespace sticky-notes                           # clean up
```

## Using a registry instead

Tag and push (`docker tag ...`, `docker push youruser/sticky-notes-backend:1.0`), then change the `image:` lines in `k8s/03-backend.yaml` and `k8s/04-frontend.yaml`.
