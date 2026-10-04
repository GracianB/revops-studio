# Security Notes

## Current posture

The repository is public and contains only static assets.

A repository scan in the current release found no obvious:

- GitHub personal access tokens
- OpenAI-style API keys
- Google API keys
- AWS access keys
- private keys
- Bearer tokens
- JWTs
- webhook credentials

This is pattern-based screening, not proof that every possible secret is absent.

## Data handling

The public brief flow does not submit form data to a backend.

Data is temporarily stored in \`sessionStorage\` for this browser tab so the thank-you page can prepare a local email.

The browser user remains responsible for deciding whether the email is sent.

## Third-party services

Current external services are limited to:

- Plausible analytics
- Google Calendar
- external portfolio/project links

Google Fonts were removed from the main implementation to reduce external loading and simplify the security surface.

## Hardening backlog

1. Add HTTP-level security headers through the hosting layer where supported.
2. Add a raster social preview image for richer link cards.
3. Add automated HTML validation if/when the project gains a build pipeline.
4. Consider a server-side lead endpoint only when there is a real need for persistence.

## Reporting

Security contact: gracianbaenagonzalez@gmail.com
