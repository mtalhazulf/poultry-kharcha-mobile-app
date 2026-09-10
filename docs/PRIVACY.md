# Kharcha — Privacy Policy

_Last updated: 10 September 2026_

Kharcha is an internal expense-tracking app for staff of a poultry business.
It is not offered to the general public; accounts are created by invitation
from the business's administrator only.

## Information we collect

- **Account details**: your email address and, optionally, your display name
  and profile picture (when signing in with Google).
- **Expense records you enter**: amount, expense type, date, an optional note,
  and any receipt photo you choose to attach.
- **Device permissions**: the camera (only when you tap "Photo" to capture a
  receipt). Choosing an existing picture uses the Android Photo Picker, which
  gives the app access to that one picture only.

We do not collect location, contacts, advertising identifiers or analytics.

## How it is used

Your records are stored so that you — and any colleague you explicitly share
an expense with — can view them. Administrators can see who has an account and
manage expense types; they cannot see your expenses unless you share them.

## Storage and security

Data is stored with Supabase (hosted PostgreSQL and object storage). All
traffic is encrypted in transit (HTTPS). Receipt images are kept in a private
bucket; links to them are short-lived and generated only for people entitled
to see the expense. Database row-level security enforces who can read or
change each record.

## Sharing

We do not sell or share your information with third parties. Data is shared
only with colleagues you choose within the app.

## Retention and deletion

Records stay until you delete them in the app. To close an account or have
all of its data removed, ask your administrator or contact us at the address
below; the account and its records are deleted from the database.

## Contact

_Your business name, address and support email here._
