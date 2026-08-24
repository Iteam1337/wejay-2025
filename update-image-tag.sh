#!/bin/bash

# Update deployment image tag for development
# Usage: ./update-image-tag.sh [tag]

TAG=${1:-$(git rev-parse --short HEAD)}
IMAGE="ghcr.io/iteam1337/wejay-2025:$TAG"

echo "Updating deployment image to: $IMAGE"

# Update the image in deployment.yaml
sed -i.bak "s|ghcr.io/iteam1337/wejay-2025:.*|$IMAGE|" k8s/deployment.yaml

echo "Image updated in k8s/deployment.yaml"
echo "To apply changes: kubectl apply -f k8s/deployment.yaml"
echo "To force restart: kubectl rollout restart deployment/wejay -n wejay"