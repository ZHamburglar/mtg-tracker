# MTG Tracker

Testing Action

## Running Locally

Create a single .env.local and create a symlink to each service.

`ls -la /mtg-tracker/ | grep -E "^.*\.env"`

Create an .env.local and then symlink for the .env.local in each of the service folders.

`cd /mtg-tracker && \
ln -sf "$(pwd)/.env.local" auth/.env.local && \
ln -sf "$(pwd)/.env.local" bulk/.env.local && \
ln -sf "$(pwd)/.env.local" search/.env.local && \
ln -sf "$(pwd)/.env.local" collection/.env.local && \
ln -sf "$(pwd)/.env.local" listing/.env.local && \
echo "Symlinks created successfully"`

### Need to Create the following Secrets
Currently the secrets are in "-secret.yaml" files for local development, but you might want to move them into secrets other in k8s.

`kubectl create secret generic mysql-secret --from-literal=MYSQL_ROOT_PASSWORD=supersecurepassword`

### Connecting to the DB

Run this in the terminal: `kubectl port-forward svc/mysql 3306:3306`