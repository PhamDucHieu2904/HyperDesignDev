# Robot Cat CAT-E2 clean rebuild

Open `robot_cat_rebuild.blend` in Blender 5.2 LTS or newer.

The production character is under the `ROBOT_CAT` collection. All mechanical
parts are separate and parented to explicit pivot empties in `11_RIG_HELPERS`.
The original AI mesh is preserved, hidden, and marked reference-only.

Rebuild the asset by opening the supplied reference blend and running
`robot_cat_generator_v2.py` in background mode. Validation views are in
`renders/`.
