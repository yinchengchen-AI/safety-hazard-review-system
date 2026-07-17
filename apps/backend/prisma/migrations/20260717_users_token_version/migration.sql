-- P1-6: per-user token_version so an admin can invalidate every
-- outstanding JWT immediately after password reset / role change /
-- suspected compromise. Existing rows default to 0 so all currently
-- issued tokens (which lack the claim) still validate against 0.
ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0;
