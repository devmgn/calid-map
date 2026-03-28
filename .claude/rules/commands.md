# Development Commands

```bash
pnpm dev                              # Dev server (Turbopack)
pnpm build                            # Production build
pnpm start                            # Start production server
pnpm check                            # All checks (Oxlint + Oxfmt + Knip)
pnpm fix                              # Auto-fix lint + format
pnpm knip                             # Dead code detection
pnpm test                             # Run all tests
pnpm test:unit                        # Unit tests only
pnpm test:watch                       # Watch mode
pnpm test:coverage                    # Tests with coverage (80% threshold)
pnpm test:update                      # Update snapshots
pnpm vitest run path/to/test.test.ts  # Specific test file
pnpm storybook                        # Storybook dev server
pnpm build-storybook                  # Storybook static build
pnpm scrape                           # Scrape store/sale data
pnpm db:generate                      # Generate Drizzle migrations
pnpm db:migrate                       # Run Drizzle migrations
pnpm db:studio                        # Open Drizzle Studio
pnpm analyze                          # Bundle size analysis (requires build)
```
