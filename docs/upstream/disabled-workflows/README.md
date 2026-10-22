# Archived upstream release workflows

These three HaVeWa workflows were imported for history/provenance but deliberately moved out of `.github/workflows/` during the WEG HomeManager integration:

- `docker-publish.yml.txt`: automatically publishes GHCR container images on main pushes.
- `pages.yml.txt`: deploys GitHub Pages marketing/docs.
- `casaos-store.yml.txt`: creates or modifies a GitHub Release for the CasaOS app store.

They must **not** be automatically activated in WEG HomeManager because a first baseline merge is not a production release. Review and replace paths, image names, permissions, secrets and tests before restoring any release automation. They remain readable here for design comparison.
