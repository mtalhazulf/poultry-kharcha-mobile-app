# MPS Expense Tracker — architecture (organizations + enterprise UI)

This is the build contract for the multi-organization rewrite. Every part of the
app (database, API, contexts, navigation, screens) follows the names below.
If you must deviate, keep the exported names stable and note it at the end.

## 1. Product decisions

- Anyone can create an account (email/password or Google). Invite-only sign-up is gone.
- A signed-in user with no active organization sees **OrgWelcome**. From there
  they can **Create organization** (enter a name) or **Join with invite code**.
- Joining with a code creates a **pending** membership. An org owner/admin must
  approve it. Until then the user sees "Waiting for approval" and can cancel.
- A person can belong to several organizations. The org switcher (header, top
  left) lists them. With a single org it still shows the org name, and the sheet
  offers "Create organization" / "Join with invite code".
- Roles per organization: `owner` (exactly one; the creator), `admin`, `member`.
  Status per membership: `active`, `pending`, `disabled`.
- Visibility: owner/admin see **all** expenses in the org (needed for Reports);
  members see their own expenses plus expenses shared with them.
- Only admins manage expense types, the invite code, join requests, roles and access.
- Existing live data moves into one org named **MPS**: talha@obscode.io = owner,
  former admins = admin, others = member, formerly disabled = `disabled`.
- Biometric sign-in (opt-in, Settings → Security): when enabled and a session
  exists, opening the app (or returning after ≥ 60 s in background) shows the Lock
  screen, which prompts for fingerprint/face immediately. "Sign in with password"
  signs out. Changed/removed biometrics disable the feature and sign out.
- Enterprise look ("clean light", Ramp/Expensify): white surfaces on light gray,
  one brand accent, lucide line icons, compact rows, bottom tabs
  **Expenses · Reports · Settings** (Team lives under Settings). No emoji anywhere in the UI or data.
- Forms are keyboard-aware: the focused field always scrolls into view above the
  keyboard, "Next" moves to the next field, sticky footers ride above the keyboard.

## 2. Database — `supabase/migrations/20260911120000_organizations.sql`

### New tables
```
organizations(
  id uuid pk default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  currency text not null default 'PKR' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid null references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now())

organization_invite_codes(            -- admins only
  org_id uuid pk references organizations(id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  updated_by uuid null references profiles(id) on delete set null,
  updated_at timestamptz not null default now())

organization_members(
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  status text not null default 'pending' check (status in ('active','pending','disabled')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz null,
  approved_by uuid null references profiles(id) on delete set null,
  primary key (org_id, user_id))
  + index (user_id), partial unique index one owner per org
```
Invite codes: 8 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, shown as `XXXX-XXXX`.
Input is normalized: uppercase, strip everything that is not A–Z/0–9.

### Changed tables
- `categories`: + `org_id uuid not null` (fk, cascade), + `icon text not null default 'package'`;
  drop `emoji`; drop global unique name; unique index `(org_id, lower(name))`; index `(org_id, sort_order)`.
- `kharcha`: + `org_id uuid not null` (fk, cascade); index `(org_id, expense_date desc)`;
  `category_icon` now stores an icon key (mapped from the old emoji). `org_id` cannot change after insert (trigger).
- `profiles`: drop `role`, `disabled`.
- Drop: table `invites`, trigger/function `enforce_invite_only`, trigger/function
  `guard_profile_privileges`, functions `is_admin()`, `is_active_member()`.
  `handle_new_user` only creates the profile (display_name from user metadata).

### Helper functions (security definer, stable, `set search_path = ''`)
`is_org_member(p_org)` (active), `is_org_admin(p_org)` (active owner/admin),
`has_org_membership(p_org)` (any status), `shares_org_with(p_user)` (both active in
one org, or caller is admin of an org where p_user has any membership),
`is_shared_with_me(p_kharcha)`, `owns_kharcha(p_kharcha)` (owner and active member),
`can_access_kharcha(p_kharcha)` (active member and (owner or org admin or shared with me)),
`generate_invite_code()` (volatile).

### RLS
| table | select | write |
|---|---|---|
| organizations | `has_org_membership(id)` | none (RPC only) |
| organization_invite_codes | `is_org_admin(org_id)` | none (RPC only) |
| organization_members | own row, or admin of org, or (active member of org and row active) | none (RPC only) |
| profiles | `id = auth.uid() or shares_org_with(id)` | insert/update own row |
| categories | `is_org_member(org_id)` | insert/update/delete: `is_org_admin(org_id)` |
| kharcha | `is_org_member(org_id) and (owner_id = auth.uid() or is_org_admin(org_id) or is_shared_with_me(id))` | insert/update: owner and active member; delete: owner or org admin |
| kharcha_shares | recipient or kharcha owner (active) | insert: owner, `shared_by = auth.uid()`, recipient active in the same org; delete: owner |
| storage `receipts` | `can_access_kharcha(safe_uuid(folder[1]))` | `owns_kharcha(safe_uuid(folder[1]))` |

Receipt object keys stay `{kharcha_id}/{timestamp}-{name}`.
Realtime: `kharcha` + `kharcha_shares` stay in the publication; clients filter `org_id=eq.<org>`.

### RPCs (security definer unless noted; execute granted to `authenticated` only)
| function | returns | rules |
|---|---|---|
| `create_organization(p_name text)` | `organizations` row | caller becomes active owner; generates invite code; seeds default categories |
| `request_to_join(p_code text)` | `json {org_id, org_name, status}` | unknown code → P0002 "Invite code not found"; existing membership returns its status; disabled → 42501 |
| `approve_join_request(p_org, p_user)` | void | admin; pending → active |
| `decline_join_request(p_org, p_user)` | void | admin; deletes pending row |
| `set_member_role(p_org, p_user, p_role)` | void | admin; role in admin/member; not owner; not self |
| `set_member_status(p_org, p_user, p_status)` | void | admin; active/disabled; not owner; not self; not pending |
| `remove_member(p_org, p_user)` | void | admin; not owner; not self |
| `leave_organization(p_org)` | void | own membership (also cancels a pending request); owner cannot leave |
| `transfer_ownership(p_org, p_user)` | void | owner; target active → owner; caller → admin |
| `rename_organization(p_org, p_name)` | void | admin |
| `regenerate_invite_code(p_org)` | text | admin |
| `report_summary(p_org, p_from date, p_to date)` | json (see `ReportSummary`) | **security invoker** (RLS decides what is counted) |

Errors use clear messages with SQLSTATE: 42501 permission, P0002 not found, 23514 validation, 23505 duplicate.

### Icon keys (lucide, kebab-case)
Default categories and icons:
Feed `wheat`, Chicks `egg`, Medicine `pill`, Vaccine `syringe`, Labour `hard-hat`,
Electricity `zap`, Water `droplets`, Transport `truck`, Equipment `wrench`,
Repair `hammer`, Bedding `layers`, Rent `warehouse`, Other `package`.
Picker choices (24): `wheat egg bird pill syringe hard-hat users zap droplets flame fuel
truck wrench hammer layers warehouse house spray-can shopping-cart receipt banknote
phone wifi package`. Unknown keys render as `package`.

## 3. TypeScript contract

### `src/types/models.ts`
```ts
export type OrgRole = 'owner' | 'admin' | 'member';
export type MemberStatus = 'active' | 'pending' | 'disabled';
export type Visibility = 'private' | 'shared';
export interface Profile { id: string; email: string; display_name: string | null; avatar_url: string | null; created_at: string }
export type ProfileSummary = Pick<Profile, 'id' | 'email' | 'display_name' | 'avatar_url'>;
export interface Organization { id: string; name: string; currency: string; created_at: string }
export interface Membership { org_id: string; user_id: string; role: OrgRole; status: MemberStatus; requested_at: string; approved_at: string | null; organization: Organization }
export interface OrgMember { org_id: string; user_id: string; role: OrgRole; status: MemberStatus; requested_at: string; approved_at: string | null; profile: ProfileSummary }
export interface Kharcha { id: string; org_id: string; owner_id: string; amount: number; category: string; category_icon: string | null; note: string | null; expense_date: string; receipt_path: string | null; visibility: Visibility; created_at: string; updated_at: string }
export interface KharchaWithOwner extends Kharcha { owner: ProfileSummary | null }
export interface KharchaShareWithProfile { kharcha_id: string; shared_with: string; shared_by: string; created_at: string; profile: ProfileSummary | null }
export interface Category { id: string; org_id: string; name: string; icon: string; sort_order: number; active: boolean; created_at: string }
export interface KharchaInput { amount: number; category: string; categoryIcon: string | null; note: string | null; expenseDate: string; receiptPath?: string | null }
export interface ReportSummary {
  total: number; count: number; previousTotal: number;
  byCategory: { category: string; icon: string | null; total: number; count: number }[];
  byMember: { userId: string; name: string; email: string; total: number; count: number }[];
  byDay: { date: string; total: number }[];
}
export const DEFAULT_CATEGORIES: ReadonlyArray<{ name: string; icon: string }>;
```

### API (`src/api/*`) — all throw `AppError` (from `src/lib/errors.ts`)
- `organizations.ts`: `listMyMemberships(): Promise<Membership[]>`,
  `createOrganization(name): Promise<Organization>`,
  `requestToJoin(code): Promise<{ orgId: string; orgName: string; status: MemberStatus }>`,
  `leaveOrganization(orgId)`, `renameOrganization(orgId, name)`,
  `getInviteCode(orgId): Promise<string>`, `regenerateInviteCode(orgId): Promise<string>`,
  `transferOwnership(orgId, userId)`, `formatInviteCode(code): string`, `normalizeInviteCode(input): string`.
- `members.ts`: `listOrgMembers(orgId): Promise<OrgMember[]>`, `approveJoinRequest(orgId, userId)`,
  `declineJoinRequest(orgId, userId)`, `setMemberRole(orgId, userId, role: 'admin' | 'member')`,
  `setMemberStatus(orgId, userId, status: 'active' | 'disabled')`, `removeMember(orgId, userId)`.
- `kharcha.ts`: `listKharcha(orgId): Promise<KharchaWithOwner[]>`, `getKharcha(id): Promise<KharchaWithOwner>`,
  `createKharcha(orgId, input): Promise<Kharcha>`, `updateKharcha(id, input): Promise<Kharcha>`, `deleteKharcha(id)`.
- `categories.ts`: `listCategories(orgId, opts?: { includeInactive?: boolean }): Promise<Category[]>`,
  `addCategory(orgId, { name, icon }): Promise<Category>`,
  `updateCategory(id, patch: { name?: string; icon?: string; active?: boolean }): Promise<Category>`, `removeCategory(id)`.
- `shares.ts`: `listSharesForKharcha(kharchaId): Promise<KharchaShareWithProfile[]>`,
  `shareKharcha(kharchaId, userIds: string[])`, `unshareKharcha(kharchaId, userId)`.
- `profiles.ts`: `getMyProfile()`, `ensureMyProfile()`, `updateMyProfile({ display_name })`, `getProfilesByIds(ids)`.
- `reports.ts`: `getReportSummary(orgId, from: string, to: string): Promise<ReportSummary>` (dates `YYYY-MM-DD`).

### Hooks
- `useCategories(orgId: string | null, opts?: { includeInactive?: boolean })` →
  `{ categories, loading, error, fromCache, refresh }` (cache key per org).
- `useKharchaList(orgId: string | null)` → `{ items: KharchaWithOwner[], loading, refreshing, error, fromCache, refresh }`
  (+ `cachedAt`, `revalidate()`; realtime channel `kharcha:<orgId>:<n>` — realtime-js reuses a channel
  whose topic already exists, so each hook instance adds a counter; INSERT/UPDATE use
  `filter: org_id=eq.<orgId>`, DELETE cannot be filtered and only removes known ids; cache key per user+org).
- `useSignedUrl(path)` unchanged.

## 4. Contexts

- `AuthProvider` / `useAuth()` — unchanged shape, minus role/disabled on `Profile`;
  adds `refreshProfile()`.
- `OrgProvider` / `useOrg()` (`src/context/OrgProvider.tsx`):
  `{ memberships, activeMemberships, pendingMemberships, activeOrg: Organization | null,
  role: OrgRole | null, isAdmin, isOwner, loading, error, switchOrg(orgId), refresh(),
  createOrg(name): Promise<Organization>, joinWithCode(code): Promise<{ orgId; orgName; status }> }`.
  Active org id persisted per user in AsyncStorage `mps:active-org:v1:<userId>`;
  falls back to the first active membership. `createOrg` switches to the new org.
- `BiometricLockProvider` / `useBiometricLock()` (`src/context/BiometricLockProvider.tsx`):
  `{ available: boolean, biometryLabel: string /* "Fingerprint" | "Face unlock" | "Biometrics" */,
  enabled: boolean, locked: boolean, enable(): Promise<void>, disable(): Promise<void>,
  unlock(): Promise<boolean> }`. Built on `src/lib/biometrics.ts` (react-native-keychain).
  Supabase auth session is stored through `src/lib/secureStorage.ts` (Keychain/Keystore,
  migrating any existing AsyncStorage session on first read).

## 5. Navigation (`src/navigation`)

```ts
export type MainTabParamList = { ExpensesTab: undefined; ReportsTab: undefined; SettingsTab: undefined };
export type RootStackParamList = {
  Login: undefined; SignUp: undefined; Lock: undefined;
  OrgWelcome: undefined; CreateOrg: undefined; JoinOrg: { code?: string } | undefined;
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  ExpenseForm: { kharchaId?: string } | undefined; ExpenseDetail: { kharchaId: string };
  ExpenseTypes: undefined; ExpenseTypeEdit: { categoryId?: string } | undefined;
  OrgSettings: undefined; Team: undefined; MemberDetail: { userId: string };
  Walkthrough: { replay?: boolean } | undefined;
};
```
Gating (RootNavigator): initializing → splash; no session → Login/SignUp; locked → Lock;
org loading → splash; no active org → OrgWelcome/CreateOrg/JoinOrg; otherwise
Tabs + detail screens (+ CreateOrg/JoinOrg for adding another org; Walkthrough once per user).
Screen files: `src/screens/<Name>Screen.tsx`, default export. Tab screens:
`ExpensesScreen`, `ReportsScreen`, `SettingsScreen`. `TeamScreen` is a stack screen opened
from Settings, alongside `OrgSettingsScreen`/`MemberDetailScreen`.
Tab screens share `AppHeader` (org switcher button left: org name + chevron-down;
optional right actions) from `src/components/AppHeader.tsx`, and `OrgSwitcherSheet`.

## 6. Design system (`src/ui`, `src/theme`)

Import primitives from `src/ui` (barrel). The legacy `src/components/{ui,ListRow,Sheet,Fab,ShareModal,FilterBar}.tsx`
and `src/screens/{Dashboard,Staff,InviteStaff}Screen.tsx` are removed; nothing outside `src/ui` defines primitives.

Tokens (`src/theme/index.ts`): `colors`, `spacing`, `radius`, `typography`, `shadow`, `layout`
(types `ColorToken`, `TypographyVariant`), plus `formatAmount(amount, currency = 'PKR')`
("PKR 18,000"; two decimals only when there are cents), `formatAmountFixed` (always two decimals),
`formatAmountShort` (no decimals), `formatDate` ("10 Sep 2026"), `formatDateFriendly`
("Today" / "Yesterday" / "2 Mar"), `toIsoDate`, `parseIsoDate`, `CURRENCY`.
- Colors: bg `#F6F7F9`, surface `#FFFFFF`, surfaceMuted `#F2F4F7`, border `#E4E7EC`,
  borderStrong `#D0D5DD`, text `#101828`, textSecondary `#475467`, textTertiary `#98A2B3`,
  textInverse `#FFFFFF`, primary `#1B7F5A`, primaryPressed `#15664A`, primarySubtle `#E7F4EE`,
  primaryText `#136246`, danger `#D92D20` / dangerSubtle `#FEF3F2` (dangerPressed = dangerText `#B42318`),
  warning `#B54708` / warningSubtle `#FFFAEB`, success `#067647` / successSubtle `#ECFDF3`,
  info `#175CD3` / infoSubtle `#EFF8FF`, plus scrim, focusRing, skeleton, transparent.
- Type: largeTitle 28/34 700, title 20/26 600, headline 16/22 600, body 15/22 400,
  bodyStrong 15/22 600, callout 14/20 400, subhead 13/18 500, caption 12/16 400,
  overline 11/14 600 uppercase +0.6 tracking, amountLarge 32/38 700 tabular, amount 15/22 600 tabular.
- Spacing: xxs 2, xs 4, sm 8, md 12, lg 16, xl 20, xxl 24, xxxl 32, huge 48.
- Radius: xs 4, sm 8, md 12, lg 16, full 999. Controls: 48 (md), 40 (sm), 56 (lg).
  Icons 16/20/24, stroke 2. Rows min 56. Hairline borders, minimal shadows (floating only).
  `layout`: control {sm, md, lg}, icon {sm, md, lg}, iconStroke, tile {sm 32, md 40, lg 48},
  rowMinHeight, minTouch 48, screenPadding 16, hairline (separators), borderWidth 1 (cards, inputs).
  `shadow`: none, subtle (selected segment), floating (FAB). Cards, list groups, md/lg controls: radius md; sheets: lg.
- Categories (`src/theme/categories.ts`): `CATEGORY_ICON_CHOICES` (24), `CategoryIconName`,
  `DEFAULT_CATEGORY_ICONS`, `iconForCategory(name, icon?)`, `defaultIconFor`, `isCategoryIcon`,
  `categoryTint(name)` -> `{ fg, bg }` from `CATEGORY_TINTS` (muted, >= 4.5:1).

Primitives (`src/ui/index.ts`): `Icon`, `IconName`, `AppText`, `Button`, `IconButton`,
`TextField` (forwardRef; ref type `TextFieldRef`), `Card`, `ListGroup`, `ListItem`, `SectionHeader`, `Badge`, `Avatar`,
`IconTile`, `EmptyState`, `Banner`, `ErrorBanner`, `LoadingView`, `Skeleton`, `Segmented`,
`Chip`, `Toggle`, `Sheet`, `Screen`, `Divider`, `Money`. Also exported: `Fab`, `CategoryTile`
(`{ name, icon }`), `TONES`/`Tone`, `LIST_TEXT_INSET`, `ICON_NAMES`, `isIconName`, `initialsFor`, `avatarTint`.
Icon keys follow lucide 1.x names: `funnel`, `fingerprint-pattern`, `building-complex`, `trash`,
`circle-question-mark`; the old names `filter`, `fingerprint`, `building-2`, `trash-2`, `circle-help` stay as aliases.
`Screen` is the standard container: `{ scroll?, keyboard?, header?, footer?, refreshControl?, padded?, gap?,
contentStyle?, style?, background?: 'bg' | 'surface', edges?, keyboardOffset?, scrollProps? }`.
With `keyboard` it uses `KeyboardAwareScrollView` and renders `footer` in `KeyboardStickyView`.
Top/left/right safe area comes from SafeAreaView; the bottom inset goes into the content or footer,
except inside the bottom tab navigator. `Sheet`: `{ visible, onClose, title?, subtitle?, footer?,
scroll?, dismissible?, showClose?, contentStyle?, testID? }`.

Keyboard rules: root wrapped in `KeyboardProvider`; every form uses `Screen keyboard`
(or `Sheet`, which is keyboard-aware); fields chain with `returnKeyType="next"` →
`nextRef.current?.focus()` and `submitBehavior="submit"`; the last field submits;
single-purpose forms `autoFocus` the first field; `keyboardShouldPersistTaps="handled"`.

Copy: sentence case, short, no emoji, no exclamation marks, US spelling "organization".
Amounts `PKR 18,000` with tabular numbers.

## 7. Testing
- Jest: logic tests for models, theme formatters, categories/icons, invite-code helpers.
- Maestro `.maestro/smoke.yaml` (CI, demo member account in org MPS): login → Expenses → add →
  detail → delete → Settings → Expense types. Keep testIDs: `login-email`, `login-password`,
  `login-submit`, `walkthrough-next`, `dashboard-fab`, `form-amount`, `category-<Name>`,
  `form-note`, `receipt-gallery`, `receipt-preview-local`, `form-submit`, `detail-amount`,
  `receipt-preview-loaded`, `open-settings` (Settings tab button), `settings-open-types`.

## 8. Data layer notes (additions and deviations from §2–4)

Database (`20260911120000_organizations.sql`; dry-run verified on the live project, not applied):
- Internal functions with no client EXECUTE: `assign_invite_code(p_org, p_actor)` (sets/replaces a code,
  retries on a unique collision), `revoke_member_shares(p_org, p_user)`, trigger fn `prevent_kharcha_org_change()`.
- `remove_member` and `leave_organization` also delete shares made to that person on that organization's
  expenses; an expense left without recipients goes back to `private`.
- Checks: `categories.icon` and `kharcha.category_icon` must be icon keys (`^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 40
  chars); emoji are rejected with 23514.
- `profiles`: clients may update only `display_name` and `avatar_url` (column grants). Email follows auth.
- `report_summary`: 42501 when the caller is not an active member; `previousTotal` = the equally long period
  ending the day before `p_from`; `byCategory`/`byMember` sorted by total desc; `byDay` only has days with
  expenses (ascending); `byMember.name` = display name, else email, else "Former member".
- Data move: the owner is always `active`; `requested_at` = profile `created_at`; `approved_by` null;
  expense `updated_at` is preserved.
- FK names for embeds: `kharcha_owner_id_fkey`, `kharcha_shares_shared_with_fkey`,
  `organization_members_user_id_fkey`, `organization_members_org_id_fkey`.
- Rollout: app builds from before this change cannot save expenses once the migration is applied.

TypeScript:
- `updateKharcha(id, input: Partial<KharchaInput>)` (a full input still fits). A `categoryIcon` that is not a
  valid key is saved as null.
- `src/api/staff.ts` and `searchProfilesByEmail` are removed; share recipients come from `listOrgMembers`.
- Extra exports: models `ORG_ROLES`, `MEMBER_STATUSES`, `isOrgRole`, `isMemberStatus`, `isAdminRole`,
  `isIconKey`, `toProfileSummary`, `toOrganization`; organizations `INVITE_CODE_ALPHABET`,
  `INVITE_CODE_LENGTH`, `isValidInviteCode`, `validateOrganizationName`, `compareMemberships`,
  `parseJoinRequestResult`, `JoinRequestResult`; members `memberDisplayName`, `compareMembers`; reports
  `parseReportSummary`, `fillDailyTotals(byDay, from, to)`; `defaultCategoriesFor(orgId)`;
  OrgProvider `pickActiveMembership`, `activeOrgStorageKey`.
- `AppError`: a 42501 raised by an RPC keeps its sentence (raw RLS/grant wording still becomes the generic
  message); P0002 → `not_found` with the server sentence (e.g. "Invite code not found").
- `useCategories`: offline with nothing cached (active list only) shows `DEFAULT_CATEGORIES` with ids
  `default-<name>` and `fromCache: true`.
- `OrgProvider` caches memberships per user (`mps:memberships:v1:<userId>`) so the app opens offline;
  `loading` turns false once a cached list is shown. No polling: a "Waiting for approval" screen should
  call `refresh()`; memberships also refresh on foreground.
- Sign-out clears that user's expense snapshots, memberships and expense-type caches (`clearUserCaches`).

## 9. Design system and biometrics notes (additions and deviations from §4 and §6)
- `useBiometricLock()` also returns `ready: boolean`: false while the signed-in user's preference
  loads on cold start. The provider paints a plain background meanwhile, so app content never
  flashes before the Lock screen. `enable()` resolves without enabling when the prompt is
  cancelled and throws `AppError` when biometrics are not set up or enrollment fails.
- `formatAmount` hides ".00" for whole amounts to match "PKR 18,000"; use `formatAmountFixed`
  when two decimals are required.
- lucide 1.x renamed five icons; see §6 for the canonical keys and aliases.
- Relock after background uses AppState `background` only. The camera/gallery pickers background
  the app, so a pick that takes 60 s or longer would lock on return and unmount the form behind
  it; `suspendRelock()` holds the relock off while a picker is open (with a one-second grace for
  the foreground event that follows the picker's result). Render Lock over the stack rather than
  replacing it if in-progress forms must survive anything longer.
- `Money variant="amountLarge"` draws the currency code at `typography.title` size; pass `exact`
  for the two-decimal form the expense detail uses.
- Two sizes sit outside the §6 scale on purpose: the stack header title is 17 (between `headline`
  16 and `title` 20, so a detail title is not lighter than the list titles under it) and the tab
  bar icons are 22 (between `layout.icon.md` 20 and `.lg` 24, so the labels stay the focus). The
  tab label reads its weight from `typography.subhead`.
- `Segmented` is 48 tall at `md` (42dp per segment plus 4dp of hitSlop on the segment *and* the
  track): Android never looks for slop that overflows the parent. `SectionHeader` grows to 48
  and stretches its action for the same reason.
- The Expenses tab resets its filters, scope and search with a state reset rather than a `key`,
  so the header's org switcher survives an organization switch long enough to animate closed.
