<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

When adding or moving Convex functions, follow the folder conventions in
`Documentation/convex-structure.md`.

## User action feedback

After user-initiated UI actions complete (settings saves, invites, deletes,
etc.), show success or error feedback with Sonner toasts via
`@/lib/user-feedback`. See `.cursor/rules/user-feedback.mdc`.

<!-- convex-ai-end -->
