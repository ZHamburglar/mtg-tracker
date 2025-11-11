### MTG Tracker

Testing Action

### Need to Create the following Secrets
Currently the secrets are in "-secret.yaml" files for local development, but you might want to move them into secrets other in k8s.

`kubectl create secret generic mysql-secret --from-literal=MYSQL_ROOT_PASSWORD=supersecurepassword`

### Connecting to the DB

Run this in the terminal: `kubectl port-forward svc/mysql 3306:3306`