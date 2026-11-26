# BirdlyQuest bird photo ID: training

`birdid_colab.ipynb` trains the on-phone model behind **✨ Identify it**.

**Open in Colab:** https://colab.research.google.com/github/ggranger757/BirdlyQuest/blob/main/training/birdid_colab.ipynb

1. Runtime → Change runtime type → **T4 GPU** → Save.
2. Runtime → **Run all**, and allow Google Drive access. Progress is saved in Drive (`BirdlyQuest-birdid/`). If Colab disconnects, Run all again and it resumes.
3. Takes about 3–5 hours. The result is `birdlyquest-birdid.zip`, which downloads at the end and is also saved in Drive.

## Licensing (the app is sold, so this matters)
* **Photos:** only iNaturalist photos licensed **CC0** or **CC BY 4.0** are downloaded. Both allow commercial use. CC BY requires credit: `credits.json` (grouped by photographer) is shown in the app, and `credits_photos.csv` lists every photo with its link and licence. CC BY-NC, CC BY-SA and all-rights-reserved photos are never used; the notebook asserts this.
* **Starting model:** `efficientnet_b0` from timm (Apache-2.0 code and weights), pre-trained on ImageNet-1k. ImageNet's own terms are non-commercial; whether that carries over to fine-tuned weights is legally unsettled, though it's widespread practice. Get legal advice if this becomes material.
* **Runtime in the app:** onnxruntime-web (MIT).

## Species
The 122 BirdDex species plus the ~150 most-observed species around each of the app's regions. The notebook carries these from `src/data/species.ts` and `src/data/regions.ts`; to change them, edit and regenerate the notebook. Species with fewer than 25 usable CC0/CC BY photos are left out, and the notebook prints which ones.
