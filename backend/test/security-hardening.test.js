import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://frontend.test';
process.env.TWITCH_CLIENT_ID = 'test-client-id';
process.env.TWITCH_CLIENT_SECRET = 'test-client-secret';
process.env.TWITCH_REDIRECT_URI = 'http://backend.test/auth/twitch/callback';
process.env.TOKEN_ENCRYPTION_KEY = '0000000000000000000000000000000000000000000000000000000000000000';

const { createApp } = await import('../src/index.js');

function fakeDb({ session = null, templateCount = 0 } = {}) {
  const queries = [];
  async function query(sql, params) {
    queries.push({ sql, params });
    if (sql.startsWith('SELECT user_id, expires_at')) {
      return { rows: session ? [session] : [] };
    }
    if (sql.startsWith('SELECT COUNT(*)')) return { rows: [{ count: templateCount }] };
    if (sql.startsWith('INSERT INTO templates')) {
      const [id, userId, name, channels, audioMode, activeChannel, volumes, chatBarOpen, now] = params;
      return {
        rows: [
          {
            id,
            user_id: userId,
            name,
            channels,
            audio_mode: audioMode,
            active_channel: activeChannel,
            volumes,
            chat_bar_open: chatBarOpen,
            is_public: 0,
            created_at: now,
            updated_at: now,
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.startsWith('DELETE FROM sessions')) return { rowCount: 1, rows: [] };
    return { rows: [], rowCount: 0 };
  }
  return {
    queries,
    query,
    async connect() {
      return { query, release() {} };
    },
  };
}

async function withServer(app, callback) {
  const server = app.listen(0);
  try {
    const address = server.address();
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function cookieValue(response, name) {
  const header = response.headers.get('set-cookie');
  assert.ok(header, `expected ${name} cookie`);
  return header.split(';', 1)[0];
}

test('OAuth callback requires the initiating browser nonce and consumes matching state', async () => {
  const fetchCalls = [];
  const app = createApp({
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      return new Response('{}');
    },
  });

  await withServer(app, async (baseUrl) => {
    const login = await fetch(`${baseUrl}/auth/twitch/login`, { redirect: 'manual' });
    assert.equal(login.status, 302);
    const state = new URL(login.headers.get('location')).searchParams.get('state');
    const nonceCookie = cookieValue(login, 'oauth_nonce');

    const mismatch = await fetch(`${baseUrl}/auth/twitch/callback?state=${state}&code=attacker-code`, {
      redirect: 'manual',
    });
    assert.equal(mismatch.status, 400);
    assert.match(await mismatch.text(), /mismatched/);
    assert.equal(fetchCalls.length, 0);

    const missingCode = await fetch(`${baseUrl}/auth/twitch/callback?state=${state}`, {
      headers: { Cookie: nonceCookie },
      redirect: 'manual',
    });
    assert.equal(missingCode.status, 400);
    assert.match(await missingCode.text(), /Missing authorization code/);

    const replay = await fetch(`${baseUrl}/auth/twitch/callback?state=${state}`, {
      headers: { Cookie: nonceCookie },
      redirect: 'manual',
    });
    assert.equal(replay.status, 400);
    assert.match(await replay.text(), /Invalid or expired/);
  });
});

test('expired OAuth transactions are rejected and login starts are capped', async () => {
  const app = createApp({
    oauthStateTtlMs: 20,
    loginRateLimit: { windowMs: 60_000, max: 100 },
  });

  await withServer(app, async (baseUrl) => {
    const login = await fetch(`${baseUrl}/auth/twitch/login`, { redirect: 'manual' });
    const state = new URL(login.headers.get('location')).searchParams.get('state');
    const nonceCookie = cookieValue(login, 'oauth_nonce');
    await new Promise((resolve) => setTimeout(resolve, 30));
    const expired = await fetch(`${baseUrl}/auth/twitch/callback?state=${state}`, {
      headers: { Cookie: nonceCookie },
    });
    assert.equal(expired.status, 400);
    assert.match(await expired.text(), /expired/);

    const cappedApp = createApp({ loginRateLimit: { windowMs: 60_000, max: 100 } });
    await withServer(cappedApp, async (cappedBaseUrl) => {
      let cookie;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await fetch(`${cappedBaseUrl}/auth/twitch/login`, {
          headers: cookie ? { Cookie: cookie } : {},
          redirect: 'manual',
        });
        assert.equal(response.status, 302);
        cookie ??= cookieValue(response, 'oauth_nonce');
      }
      const blocked = await fetch(`${cappedBaseUrl}/auth/twitch/login`, {
        headers: { Cookie: cookie },
        redirect: 'manual',
      });
      assert.equal(blocked.status, 429);
    });
  });
});

test('public proxy routes enforce rate limits before upstream work', async () => {
  let upstreamCalls = 0;
  const app = createApp({
    publicRateLimit: { windowMs: 60_000, max: 10 },
    getAppToken: async () => 'test-token',
    fetchImpl: async () => {
      upstreamCalls += 1;
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    },
  });

  await withServer(app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/stream-status?logins=streamer`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/stream-status?logins=streamer`)).status, 200);
    assert.equal(upstreamCalls, 1);
  });

  const rateLimitedApp = createApp({
    publicRateLimit: { windowMs: 60_000, max: 1 },
    getAppToken: async () => 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
  });
  await withServer(rateLimitedApp, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/stream-status`)).status, 200);
    const blocked = await fetch(`${baseUrl}/api/stream-status`);
    assert.equal(blocked.status, 429);
  });
});

test('cookie-authenticated state changes require the configured origin', async () => {
  const db = fakeDb({ session: { user_id: 'user-1', expires_at: new Date(Date.now() + 60_000).toISOString() } });
  const app = createApp({ db });

  await withServer(app, async (baseUrl) => {
    const logout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: 'session_id=session-1', Origin: 'http://attacker.test' },
    });
    assert.equal(logout.status, 403);
    assert.equal(db.queries.length, 0);

    const allowedLogout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: 'session_id=session-1', Origin: 'http://frontend.test' },
    });
    assert.equal(allowedLogout.status, 204);
    assert.equal(db.queries.length, 1);
  });
});

test('template writes enforce field bounds and per-user quota', async () => {
  const session = { user_id: 'user-1', expires_at: new Date(Date.now() + 60_000).toISOString() };
  const tooLongDb = fakeDb({ session });
  const tooLongApp = createApp({ db: tooLongDb });
  await withServer(tooLongApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/templates`, {
      method: 'POST',
      headers: {
        Cookie: 'session_id=session-1',
        Origin: 'http://frontend.test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'x'.repeat(101), channels: [{ loginName: 'streamer' }], audioMode: 'both' }),
    });
    assert.equal(response.status, 400);
    assert.match(await response.text(), /characters or fewer/);
  });

  const underQuotaDb = fakeDb({ session, templateCount: 99 });
  const underQuotaApp = createApp({ db: underQuotaDb });
  await withServer(underQuotaApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/templates`, {
      method: 'POST',
      headers: {
        Cookie: 'session_id=session-1',
        Origin: 'http://frontend.test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'saved', channels: [{ loginName: 'streamer' }], audioMode: 'both' }),
    });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.name, 'saved');
    const sqlSequence = underQuotaDb.queries.map((q) => q.sql.trim().split(/\s+/)[0]);
    assert.deepEqual(sqlSequence, ['SELECT', 'BEGIN', 'SELECT', 'SELECT', 'INSERT', 'COMMIT']);
    assert.match(underQuotaDb.queries[2].sql, /pg_advisory_xact_lock/);
  });

  const quotaDb = fakeDb({ session, templateCount: 100 });
  const quotaApp = createApp({ db: quotaDb });
  await withServer(quotaApp, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/templates`, {
      method: 'POST',
      headers: {
        Cookie: 'session_id=session-1',
        Origin: 'http://frontend.test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'saved', channels: [{ loginName: 'streamer' }], audioMode: 'both' }),
    });
    assert.equal(response.status, 429);
    assert.match(await response.text(), /quota/);
    const sqlSequence = quotaDb.queries.map((q) => q.sql.trim().split(/\s+/)[0]);
    assert.deepEqual(sqlSequence, ['SELECT', 'BEGIN', 'SELECT', 'SELECT', 'ROLLBACK']);
  });
});

// Models Postgres's pg_advisory_xact_lock semantics closely enough to prove
// the route serializes concurrent writers per user: a lock acquired inside
// one connection's transaction blocks any other connection's lock request
// for the same key until that transaction COMMITs or ROLLBACKs. If the route
// stopped taking the lock (or took it after the COUNT check), concurrent
// requests would interleave their COUNT queries before any INSERT commits
// and blow through the cap — exactly the race this test is meant to catch.
function fakeAdvisoryLockDb({ session, templateCount = 0 }) {
  const queries = [];
  let count = templateCount;
  const locks = new Map();

  function acquireLock(key) {
    const state = locks.get(key) ?? { locked: false, waiters: [] };
    locks.set(key, state);
    if (!state.locked) {
      state.locked = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => state.waiters.push(resolve));
  }
  function releaseLock(key) {
    const state = locks.get(key);
    if (!state) return;
    const next = state.waiters.shift();
    if (next) next();
    else state.locked = false;
  }

  async function connect() {
    let heldLockKey = null;
    async function query(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('BEGIN')) return { rows: [] };
      if (sql.startsWith('SELECT pg_advisory_xact_lock')) {
        heldLockKey = params[0];
        await acquireLock(heldLockKey);
        return { rows: [] };
      }
      if (sql.startsWith('SELECT COUNT(*)')) {
        // Snapshot the count now, then yield before returning it, so that
        // any writer not actually serialized by the advisory lock overlaps
        // with the others here and reads the same stale count they did,
        // instead of the delay incidentally masking the race.
        const snapshot = count;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { rows: [{ count: snapshot }] };
      }
      if (sql.startsWith('INSERT INTO templates')) {
        count += 1;
        const [id, userId, name, channels, audioMode, activeChannel, volumes, chatBarOpen, now] = params;
        return {
          rows: [{
            id, user_id: userId, name, channels, audio_mode: audioMode, active_channel: activeChannel,
            volumes, chat_bar_open: chatBarOpen, is_public: 0, created_at: now, updated_at: now,
          }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('COMMIT') || sql.startsWith('ROLLBACK')) {
        if (heldLockKey) {
          releaseLock(heldLockKey);
          heldLockKey = null;
        }
        return { rows: [] };
      }
      return { rows: [], rowCount: 0 };
    }
    return { query, release() {} };
  }

  return {
    queries,
    connect,
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.startsWith('SELECT user_id, expires_at')) return { rows: session ? [session] : [] };
      return { rows: [], rowCount: 0 };
    },
    getCount: () => count,
  };
}

test('concurrent template writes near quota do not exceed the per-user cap', async () => {
  const session = { user_id: 'user-1', expires_at: new Date(Date.now() + 60_000).toISOString() };
  const db = fakeAdvisoryLockDb({ session, templateCount: 71 });
  const app = createApp({ db, templateRateLimit: { windowMs: 60_000, max: 100 } });

  await withServer(app, async (baseUrl) => {
    const responses = await Promise.all(
      Array.from({ length: 30 }, () =>
        fetch(`${baseUrl}/api/templates`, {
          method: 'POST',
          headers: {
            Cookie: 'session_id=session-1',
            Origin: 'http://frontend.test',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'saved', channels: [{ loginName: 'streamer' }], audioMode: 'both' }),
        }),
      ),
    );
    const statuses = responses.map((r) => r.status);
    const created = statuses.filter((s) => s === 201).length;
    const rejected = statuses.filter((s) => s === 429).length;
    assert.equal(created + rejected, 30, `unexpected statuses: ${statuses.join(',')}`);
    assert.equal(created, 29, '30 concurrent writers starting at 71 should admit exactly 29 before hitting the 100 cap');
    assert.equal(db.getCount(), 100, 'template count must land exactly on the cap, never over it');
  });
});

test('backend dependency tree has no known qs advisories', async () => {
  const cwd = new URL('..', import.meta.url);
  let stdout;
  try {
    ({ stdout } = await execFileAsync('npm', ['audit', '--omit=dev', '--json'], { cwd }));
  } catch (err) {
    // npm audit exits non-zero when it finds vulnerabilities; its JSON report is still on stdout.
    stdout = err.stdout;
  }
  const report = JSON.parse(stdout);
  assert.equal(
    report.metadata.vulnerabilities.total,
    0,
    `expected no vulnerabilities, found: ${JSON.stringify(report.vulnerabilities)}`,
  );
});
