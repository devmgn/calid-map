---
paths:
  - "src/schemas/**"
---

# Schema Rules

## Zod v4

- Used for runtime validation (forms, environment variables)
- Derive types with `z.infer<typeof schema>`

## Environment Variable Schema

Validated at `src/config/env.ts` via `envSchema.parse()`.

## Form Schema

Integrate with React Hook Form via `zodResolver`. Place schemas in `src/schemas/` or co-locate within feature directories.
