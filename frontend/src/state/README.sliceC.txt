Slice C notes (local-only)
--------------------------
Storage keys introduced:
- fc_feature_flags_v1    -> { authEnabled: boolean }
- fc_users_v1            -> User[] (local sign-in entities; salted+hashed passwords)
- fc_session_v1          -> { currentUserId: string | null }
- fc_settings_v3         -> (unchanged key) now includes myAgendaOnly?: boolean
- fc_events_v1           -> (unchanged key) events can optionally include createdByUserId?, ownerMemberId?

Migrations:
- lib/migrateSliceC.ts is idempotent and safe to run at every app start.

Decorators & filtering:
- state/events-agenda.ts provides agendaFilter() and useAgendaList().
- Calendar/EventGrid/EventModal are not modified; "My agenda" filtering is toggled via settings.myAgendaOnly.
- With feature flag OFF, all additions are dormant and app behaves exactly like Slice A/B.

Permissions (enforced by consumers that perform writes):
- Use canEditAccordingToAuth(evt, ctx, authEnabled) before persisting edits/deletes in future slices.
