# @spectral/db

Prisma-backed data access package for Spectral.

Responsibilities:

- bootstrap Prisma v7 with `@prisma/adapter-pg`
- expose repository helpers instead of raw Prisma calls
- centralize transaction helpers
- import and seed legacy Specterr presets
