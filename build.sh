docker build -t valhalla.website -f configs/site.Dockerfile .
docker build -t valhalla.game -f configs/game.Dockerfile .
docker build -t valhalla.ai -f configs/ai.Dockerfile .

docker tag valhalla.website gcr.io/valhalla-0/website
docker tag valhalla.game gcr.io/valhalla-0/valhalla.game
docker tag valhalla.ai gcr.io/valhalla-0/valhalla.ai

gcloud docker -- push gcr.io/valhalla-0/website
gcloud docker -- push gcr.io/valhalla-0/valhalla.game
gcloud docker -- push gcr.io/valhalla-0/valhalla.ai
