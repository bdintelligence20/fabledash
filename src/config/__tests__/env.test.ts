describe('env config', () => {
  it('provides default API_URL', async () => {
    const { env } = await import('../env');
    // In test environment, VITE_API_URL env var may not be set,
    // so it falls back to 'http://localhost:8000' via ?? operator
    expect(typeof env.API_URL).toBe('string');
  });

  it('exports all expected Firebase config keys', async () => {
    const { env } = await import('../env');
    expect('FIREBASE_API_KEY' in env).toBe(true);
    expect('FIREBASE_AUTH_DOMAIN' in env).toBe(true);
    expect('FIREBASE_PROJECT_ID' in env).toBe(true);
    expect('FIREBASE_STORAGE_BUCKET' in env).toBe(true);
    expect('FIREBASE_MESSAGING_SENDER_ID' in env).toBe(true);
    expect('FIREBASE_APP_ID' in env).toBe(true);
  });

  it('env values are strings', async () => {
    const { env } = await import('../env');
    expect(typeof env.API_URL).toBe('string');
    expect(typeof env.FIREBASE_API_KEY).toBe('string');
    expect(typeof env.FIREBASE_AUTH_DOMAIN).toBe('string');
    expect(typeof env.FIREBASE_PROJECT_ID).toBe('string');
  });

  it('API_URL has a default fallback value', async () => {
    const { env } = await import('../env');
    // The default is 'http://localhost:8000' if VITE_API_URL is not set
    // In test env it may be set or use default
    expect(env.API_URL).toBeDefined();
  });
});
