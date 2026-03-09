

## Plan: Enhance Email Validator with Full python-email-validator Parity + Test

### Current State
The `validate-leads` edge function already has basic python-email-validator logic (syntax, disposable, MX, catch-all). However, it's missing several features from the library.

### Missing Features to Add

1. **Null MX rejection** (RFC 7505) — if MX record is `.` (priority 0, empty exchange), reject as undeliverable
2. **SPF reject-all check** — query TXT records for `v=spf1 -all` which means domain explicitly rejects all mail
3. **Unicode/IDN normalization** — handle internationalized domain names via Punycode detection
4. **Improved catch-all heuristic** — current logic (single MX = catch-all) is too aggressive; remove false positives
5. **Validation reason stored in DB** — add a `reason` text column to `email_validations` so users can see *why* an email failed

### Changes

**1. Database migration** — Add `reason` column to `email_validations` table

**2. `supabase/functions/validate-leads/index.ts`**:
- Add Null MX detection (MX record with exchange `.` or empty)
- Add SPF reject-all check via TXT DNS lookup
- Fix catch-all heuristic: only flag if domain has a wildcard MX pattern, not just single MX
- Store validation reason in `email_validations.reason`
- Add more disposable domains

**3. `src/pages/LeadImport.tsx`**:
- Show validation reason as a tooltip on the validation badge in the leads table
- Add "risky" to the validation icons map (currently missing — catch-all returns "risky" but UI only has `valid`, `invalid`, `catchall`, `pending`)

### Technical Details

```text
Validation Pipeline (updated):
  1. Syntax check (RFC 5321/5322)
  2. Special-use domain rejection (RFC 6761)
  3. Disposable domain check
  4. MX lookup → Null MX rejection
  5. A/AAAA fallback (RFC 5321 §5.1)
  6. SPF reject-all check (TXT record "v=spf1 -all")
  7. Catch-all heuristic (improved)
  8. Store result + reason
```

