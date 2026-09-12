import React, { act, createRef } from 'react';
import { ScrollView, Switch, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { CATEGORY_ICON_CHOICES } from '../src/theme/categories';
import {
  AppText,
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  CategoryTile,
  Chip,
  Divider,
  EmptyState,
  ErrorBanner,
  Fab,
  Icon,
  ICON_NAMES,
  IconButton,
  IconTile,
  initialsFor,
  isIconName,
  ListGroup,
  ListItem,
  LoadingView,
  Money,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  Skeleton,
  TextField,
  Toggle,
  type IconName,
  type TextFieldRef,
} from '../src/ui';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

let renderer: ReactTestRenderer | null = null;

async function render(node: React.ReactElement): Promise<ReactTestRenderer> {
  let created: ReactTestRenderer | null = null;
  await act(async () => {
    created = TestRenderer.create(<SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>, {
      createNodeMock: () => ({}),
    });
  });
  if (!created) {
    throw new Error('render failed');
  }
  renderer = created;
  return created;
}

function json(r: ReactTestRenderer): string {
  return JSON.stringify(r.toJSON());
}

/** Rendered <Icon name=...> instances (memo reports its inner function as `type`). */
function iconsNamed(r: ReactTestRenderer, name: string) {
  return r.root.findAll(
    node =>
      typeof node.type === 'function' &&
      (node.type as { name?: string }).name === 'IconBase' &&
      node.props.name === name,
  );
}

afterEach(async () => {
  if (renderer) {
    const r = renderer;
    renderer = null;
    await act(async () => r.unmount());
  }
});

describe('Icon', () => {
  it('registers every expense type icon', () => {
    for (const key of CATEGORY_ICON_CHOICES) {
      expect(isIconName(key)).toBe(true);
    }
  });

  it('registers the app icons, including renamed lucide names and their aliases', () => {
    const required = [
      'receipt', 'chart-column', 'chart-pie', 'users', 'settings', 'plus', 'search',
      'sliders-horizontal', 'funnel', 'filter', 'chevron-right', 'chevron-left', 'chevron-down',
      'chevron-up', 'x', 'check', 'circle-check', 'circle-alert', 'triangle-alert', 'info', 'lock',
      'fingerprint-pattern', 'fingerprint', 'scan-face', 'mail', 'eye', 'eye-off', 'log-out', 'log-in',
      'building-complex', 'building-2', 'key-round', 'copy', 'share-2', 'refresh-cw', 'user',
      'user-plus', 'user-check', 'user-x', 'shield', 'shield-check', 'trash', 'trash-2', 'pencil',
      'camera', 'image', 'paperclip', 'calendar', 'trending-up', 'trending-down', 'ellipsis',
      'circle-question-mark', 'circle-help', 'file-text', 'wifi-off', 'clock', 'hourglass', 'send',
      'archive', 'arrow-left-right', 'crown', 'list', 'grid-2x2', 'circle-plus', 'ban',
    ];
    for (const key of required) {
      expect(isIconName(key)).toBe(true);
    }
    for (const key of ICON_NAMES) {
      expect(key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
    expect(isIconName('not-an-icon')).toBe(false);
  });

  it('renders unknown names as a package instead of crashing', async () => {
    const r = await render(<Icon name={'nope' as IconName} />);
    expect(r.toJSON()).not.toBeNull();
  });
});

describe('Button', () => {
  it('renders the title and exposes busy/disabled while loading', async () => {
    const onPress = jest.fn();
    const r = await render(<Button title="Save expense" loading onPress={onPress} testID="form-submit" />);
    expect(json(r)).toContain('Save expense');
    const button = r.root.findAll(
      node => node.props.testID === 'form-submit' && node.props.accessibilityState !== undefined,
    )[0];
    expect(button?.props.accessibilityState).toEqual({ disabled: true, busy: true });
  });
});

describe('TextField', () => {
  it('forwards the ref and testID to the TextInput', async () => {
    const ref = createRef<TextFieldRef>();
    const r = await render(<TextField ref={ref} label="Email" testID="login-email" />);
    expect(ref.current).not.toBeNull();
    const input = r.root.findByType(TextInput);
    expect(input.props.testID).toBe('login-email');
    expect(input.props.accessibilityLabel).toBe('Email');
  });

  it('toggles password visibility', async () => {
    const r = await render(<TextField label="Password" password />);
    expect(r.root.findByType(TextInput).props.secureTextEntry).toBe(true);
    const toggle = r.root.findByType(IconButton);
    await act(async () => toggle.props.onPress());
    expect(r.root.findByType(TextInput).props.secureTextEntry).toBe(false);
  });

  it('shows the error instead of the helper text', async () => {
    const r = await render(<TextField label="Amount" helperText="In PKR" error="Enter an amount" />);
    const out = json(r);
    expect(out).toContain('Enter an amount');
    expect(out).not.toContain('In PKR');
  });
});

describe('ListGroup and ListItem', () => {
  it('separates rows with dividers and skips empty children', async () => {
    const r = await render(
      <ListGroup title="Security">
        <ListItem title="Biometric sign-in" leadingIcon="fingerprint-pattern" />
        {null}
        <ListItem title="Change password" onPress={jest.fn()} />
      </ListGroup>,
    );
    expect(r.root.findAllByType(ListItem)).toHaveLength(2);
    expect(r.root.findAllByType(Divider)).toHaveLength(1);
    expect(json(r)).toContain('Security');
  });

  it('renders nothing without rows', async () => {
    const r = await render(<ListGroup title="Empty group">{null}</ListGroup>);
    expect(json(r)).not.toContain('Empty group');
  });

  it('adds a chevron to pressable rows but not destructive ones', async () => {
    const r = await render(
      <>
        <ListItem title="Expense types" onPress={jest.fn()} />
        <ListItem title="Sign out" destructive onPress={jest.fn()} />
      </>,
    );
    expect(iconsNamed(r, 'chevron-right')).toHaveLength(1);
  });

  it('describes amounts to screen readers', async () => {
    const r = await render(<ListItem title="Feed" subtitle="Today" amount={18000} onPress={jest.fn()} />);
    const row = r.root.findAll(node => node.props.accessibilityLabel === 'Feed, Today, PKR 18,000');
    expect(row.length).toBeGreaterThan(0);
  });
});

describe('Money', () => {
  it('formats large amounts with a quieter currency code', async () => {
    const r = await render(<Money amount={18000} variant="amountLarge" testID="detail-amount" />);
    const out = json(r);
    expect(out).toContain('PKR ');
    expect(out).toContain('18,000');
    const text = r.root.findAll(
      node => node.props.testID === 'detail-amount' && node.props.accessibilityLabel !== undefined,
    )[0];
    expect(text?.props.accessibilityLabel).toBe('PKR 18,000');
  });
});

describe('ErrorBanner', () => {
  it('renders nothing without a message', async () => {
    const r = await render(<ErrorBanner message={null} onRetry={jest.fn()} />);
    expect(json(r)).not.toContain('Try again');
  });

  it('shows an offline warning with retry for network errors', async () => {
    const onRetry = jest.fn();
    const r = await render(<ErrorBanner message="No connection." kind="network" onRetry={onRetry} />);
    expect(iconsNamed(r, 'wifi-off')).toHaveLength(1);
    const retry = r.root.findAll(node => node.props.accessibilityLabel === 'Try again')[0];
    await act(async () => retry?.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('Segmented', () => {
  it('reports a new value only', async () => {
    const onChange = jest.fn();
    const r = await render(
      <Segmented
        value="all"
        onChange={onChange}
        options={[
          { value: 'all', label: 'All' },
          { value: 'mine', label: 'Mine' },
        ]}
      />,
    );
    const all = r.root.findAll(node => node.props.testID === 'segment-all')[0];
    const mine = r.root.findAll(node => node.props.testID === 'segment-mine')[0];
    await act(async () => all?.props.onPress());
    await act(async () => mine?.props.onPress());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('mine');
  });
});

describe('Screen', () => {
  it('uses a keyboard-aware scroll view and renders the footer', async () => {
    const r = await render(
      <Screen keyboard footer={<Button title="Save" fullWidth />}>
        <TextField label="Amount" />
      </Screen>,
    );
    expect(r.root.findAllByType(ScrollView)).toHaveLength(1);
    const out = json(r);
    expect(out).toContain('Save');
    expect(out).toContain('Amount');
  });

  it('renders plain content without a scroll view', async () => {
    const r = await render(
      <Screen>
        <AppText>Hello</AppText>
      </Screen>,
    );
    expect(r.root.findAllByType(ScrollView)).toHaveLength(0);
  });
});

describe('Sheet', () => {
  it('renders only while visible and closes from the header', async () => {
    const onClose = jest.fn();
    const r = await render(
      <Sheet visible title="Join with invite code" onClose={onClose}>
        <TextField label="Invite code" />
      </Sheet>,
    );
    expect(json(r)).toContain('Join with invite code');
    const close = r.root.findAll(node => node.type === IconButton && node.props.accessibilityLabel === 'Close')[0];
    await act(async () => close?.props.onPress());
    expect(onClose).toHaveBeenCalled();

    const hidden = await render(
      <Sheet visible={false} title="Hidden sheet" onClose={onClose}>
        <AppText>Body</AppText>
      </Sheet>,
    );
    expect(json(hidden)).not.toContain('Hidden sheet');
  });
});

describe('Avatar', () => {
  it('derives initials from the name, then the email', () => {
    expect(initialsFor('Talha Zulfiqar')).toBe('TZ');
    expect(initialsFor('  ali  ')).toBe('A');
    expect(initialsFor('Muhammad Ali Khan')).toBe('MK');
    expect(initialsFor(null, 'ops.team@example.com')).toBe('OP');
    expect(initialsFor('', '')).toBe('?');
  });
});

describe('smoke', () => {
  it('renders the remaining primitives', async () => {
    const r = await render(
      <>
        <AppText variant="largeTitle">Reports</AppText>
        <Avatar name="Sara Ahmed" email="sara@example.com" />
        <Badge label="Pending" tone="warning" dot />
        <Banner tone="info" title="Heads up" message="Receipts sync when you are online." onDismiss={jest.fn()} />
        <Card>
          <SectionHeader title="This month" action={{ label: 'See all', onPress: jest.fn() }} />
        </Card>
        <CategoryTile name="Feed" icon="wheat" />
        <IconTile icon="lock" tone="primary" size="lg" />
        <Chip label="Feed" selected onPress={jest.fn()} onRemove={jest.fn()} />
        <EmptyState icon="receipt" title="No expenses yet" message="Add your first expense." action={{ label: 'Add expense', onPress: jest.fn() }} />
        <LoadingView message="Loading" />
        <Skeleton height={12} />
        <Toggle value onValueChange={jest.fn()} />
        <Fab onPress={jest.fn()} testID="dashboard-fab" />
      </>,
    );
    const out = json(r);
    for (const text of ['Reports', 'SA', 'Pending', 'Heads up', 'This month', 'No expenses yet', 'Add']) {
      expect(out).toContain(text);
    }
    expect(r.root.findByType(Switch).props.trackColor).toEqual({ false: '#D0D5DD', true: '#1B7F5A' });
  });
});

declare const __dirname: string;

describe('no emoji', () => {
  it('keeps design-system and biometric sources free of emoji', () => {
    const fs = jest.requireActual<{
      readdirSync(path: string): string[];
      readFileSync(path: string, encoding: 'utf8'): string;
    }>('fs');
    const root = `${__dirname}/..`;
    const files = [
      ...fs.readdirSync(`${root}/src/ui`).map(name => `src/ui/${name}`),
      'src/theme/index.ts',
      'src/theme/categories.ts',
      'src/lib/biometrics.ts',
      'src/lib/secureStorage.ts',
      'src/context/BiometricLockProvider.tsx',
    ];
    for (const file of files) {
      expect({ file, emoji: /\p{Extended_Pictographic}/u.test(fs.readFileSync(`${root}/${file}`, 'utf8')) }).toEqual({
        file,
        emoji: false,
      });
    }
  });
});
