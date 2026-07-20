Illustrated worker avatars, numbered 1.png .. N.png.

Each person is assigned one of these deterministically from their name
(stable hash), so they show the same character on every screen. They are
generic illustrations, not photos of specific people — to add more
variety just drop in more numbered files (7.png, 8.png, ...) and bump
AVATAR_IMAGE_COUNT in src/avatar.ts to match.

If a file is missing, that person falls back to a coloured circle with
their initials.

(Product photos go in ../products/ instead — see that folder's README.)
