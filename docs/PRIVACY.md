# MPS Expense Tracker — Privacy Policy

_Last updated: 11 September 2026_

MPS Expense Tracker is an expense-tracking app for organizations and their
teams. Anyone can create an account. After signing in, you create your own
organization or join an existing one using an invite code; a person can
belong to more than one organization.

## Information we collect

- **Account details**: your email address and, optionally, your display name
  and profile picture (when signing in with Google).
- **Organization membership**: which organizations you belong to, your role
  (owner, admin, or member) and status (active, pending, or disabled) in
  each, and, if you created an organization, its name.
- **Expense records you enter**: amount, expense type, date, an optional
  note, and any receipt photo you choose to attach.
- **Device permissions**: the camera (only when you tap "Photo" to capture a
  receipt). Choosing an existing picture uses the Android Photo Picker, which
  gives the app access to that one picture only.
- **Biometric unlock (optional)**: if you turn on biometric sign-in in
  Settings → Security, the app asks Android to protect a local encryption key
  with your fingerprint or face. Your fingerprint or face data is handled
  entirely by the Android operating system and never leaves your device; the
  app never receives, stores, or transmits it. The app only stores whether
  biometric unlock is turned on and the key the OS protects for it.

We do not collect location, contacts, advertising identifiers or analytics.

## How it is used

Your expense records are visible within the organization(s) you belong to,
according to your role:

- **Owners and admins** of an organization can see every expense recorded in
  that organization, so they can review spending and produce reports. They
  can also manage the organization's expense types, invite code, join
  requests, and members' roles and status.
- **Members** can see their own expenses, plus any individual expense another
  active member of the same organization has explicitly shared with them.
  Sharing is only possible between active members of the same organization.

Organization admins do not see expenses from organizations you don't share
with them, and cannot see expenses from other organizations you belong to.

## Storage and security

Data is stored with Supabase (hosted PostgreSQL and object storage). All
traffic is encrypted in transit (HTTPS). Receipt images are kept in a private
bucket; links to them are short-lived and generated only for people entitled
to see the expense. Database row-level security enforces who can read or
change each record, scoped to organization membership and role.

Your sign-in session is stored on your device in the Android Keystore (via
the platform's secure credential storage), not in ordinary app storage. If
you enable biometric unlock, the app locks automatically when opened and
after about 60 seconds in the background, and unlocking requires your
fingerprint or face (or your password, which also signs out any unlocked
biometric session). If your device's enrolled fingerprints or face data
change, biometric unlock is automatically turned off and you are signed out
for safety.

## Sharing

We do not sell or share your information with third parties. Within the app,
data is shared only with:

- Members of an organization you belong to (scoped to your role, as above).
- A specific colleague you choose to share an individual expense with.

## Retention and deletion

Expense records stay until you or an organization admin deletes them.

- **Leaving an organization**: use Settings → an organization's membership
  option to leave it. Your account and any other organizations you belong to
  are unaffected; an organization's owner cannot leave without first
  transferring ownership.
- **Deleting your account or data**: contact us at the address below (or ask
  an admin of your organization to remove you and delete your records). We
  will delete your account and its records from the database.

## Contact

_Your business name, address and support email here._
